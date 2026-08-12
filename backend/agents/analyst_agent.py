from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.agents.base import BaseAgent, Tool
from backend.core.models import AnalysisResult
from backend.db.models import ChaosSession, SessionStatus, FailureResult, FailureStatus
from sqlalchemy import select


class AnalystAgent(BaseAgent):
    """
    Analyses all failure results and identifies:
    - Patterns across failures (e.g. all DB failures unhandled)
    - Most critical gaps
    - Risk scoring

    Returns a validated AnalysisResult; also yields a plain dict via
    .to_dict() so the rest of the pipeline keeps working unchanged.
    """
    name = "analyst"
    system_prompt = """You are the Analyst Agent in a chaos engineering system.
You receive a list of failure injection results and must produce a structured analysis.

Your job:
1. Identify which failure modes are consistently unhandled
2. Find patterns (e.g. all database failures crash the app)
3. Prioritise findings by severity
4. Calculate an overall risk score (0-100, higher = more dangerous)

Severity levels:
- CRITICAL: error details / stack traces leaked to users (security risk)
- HIGH: app returns 500 with no useful error message
- MEDIUM: app degrades but doesn't crash
- LOW: app handles gracefully but could improve

Return JSON:
{
  "risk_score": 75,
  "critical_findings": [
    {
      "title": "Database errors leak internal details",
      "severity": "CRITICAL",
      "affected_endpoints": ["/users", "/orders"],
      "failure_modes": ["db_connection_drop"],
      "evidence": "Response body contains SQLAlchemy traceback"
    }
  ],
  "all_findings": [...],
  "patterns": ["All POST endpoints vulnerable to malformed JSON", "No timeout handling on any endpoint"],
  "summary": "The application has significant gaps in error handling..."
}"""

    def __init__(self, db: AsyncSession, session_id: str):
        super().__init__(db, session_id)

    async def handle(self, failure_results: list[dict]) -> dict:
        """
        Run analysis and return a validated AnalysisResult serialised to dict.
        Callers that previously consumed a raw dict are unaffected.
        """
        await self._update_session_status(SessionStatus.ANALYSING)

        # Group results for analysis
        unhandled = [r for r in failure_results if r["result"] == "unhandled"]
        handled = [r for r in failure_results if r["result"] == "handled"]
        degraded = [r for r in failure_results if r["result"] == "degraded"]
        leaked = [r for r in failure_results if r.get("error_leaked")]

        raw = await self.run(
            task=f"""Analyse these chaos engineering results:

Total failures injected: {len(failure_results)}
Unhandled (app crashed/leaked): {len(unhandled)}
Handled gracefully: {len(handled)}
Degraded (partial handling): {len(degraded)}
Error details leaked to users: {len(leaked)}

Unhandled results:
{self._format_results(unhandled[:20])}

Leaked errors:
{self._format_results(leaked[:10])}

All results (for context):
{self._format_results(failure_results[:20])}

Important rules for your analysis:
- Even if all failures were "handled gracefully", still produce MEDIUM-severity findings
  for missing resilience patterns (e.g. no timeout handling, no rate-limit backoff,
  no malformed-input validation).
- A 200 response to malformed_json or null_fields means the endpoint accepts bad input
  silently — this is a MEDIUM finding worth fixing.
- A 200 response to http_timeout or slow_response means no timeout is configured — MEDIUM.
- Only use CRITICAL if error details actually leaked (stack trace, DB info, internal paths).
- Only use HIGH if the endpoint returned 500 or crashed.
- Always produce at least one finding even if the app appears healthy.

Produce a comprehensive risk analysis with specific findings and patterns.""",
            context={
                "total": len(failure_results),
                "unhandled_count": len(unhandled),
                "leaked_count": len(leaked),
            }
        )

        # Validate and coerce through the typed model.
        # If the LLM output is malformed in some fields (e.g. bad severity
        # string, missing risk_score), the model's validators normalise them
        # rather than letting silent KeyErrors propagate downstream.
        try:
            result = AnalysisResult.from_dict(raw)
        except Exception as e:
            logger.warning(
                f"[Analyst] AnalysisResult validation failed ({e}); "
                "falling back to raw dict with defaults."
            )
            # Build a safe fallback so the pipeline can always continue
            result = AnalysisResult(
                risk_score=raw.get("risk_score", 0) if isinstance(raw, dict) else 0,
                summary=raw.get("summary", "") if isinstance(raw, dict) else "",
                critical_findings=[],
                all_findings=[],
                patterns=[],
            )

        logger.info(f"[Analyst] Risk score: {result.risk_score} | "
                    f"critical={len(result.critical_findings)} "
                    f"all={len(result.all_findings)}")

        # Return a plain dict — downstream agents (FixAgent, Orchestrator,
        # FixAgent._save_report) all call .get() on this value, so the shape
        # must be preserved.  to_dict() produces exactly that shape.
        return result.to_dict()

    def _format_results(self, results: list[dict]) -> str:
        if not results:
            return "None"
        lines = []
        for r in results:
            lines.append(
                f"- {r['endpoint_path']} | {r['failure_mode']} | "
                f"status={r.get('status_code')} | leaked={r.get('error_leaked')}"
            )
        return "\n".join(lines)

    async def _update_session_status(self, status: SessionStatus):
        session = await self.db.get(ChaosSession, self.session_id)
        if session:
            session.status = status
            await self.db.flush()
