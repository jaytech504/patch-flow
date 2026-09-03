from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.agents.chaos_agent import ChaosAgent
from backend.agents.analyst_agent import AnalystAgent
from backend.agents.fix_agent import FixAgent
from backend.agents.review_agent import ReviewAgent
from backend.agents.github_agent import GitHubAgent
from backend.core.models import FixStatus
from backend.core.websocket_manager import ws_manager
from backend.core.config import get_settings
from backend.db.models import ChaosSession, SessionStatus

settings = get_settings()


class ChaosOrchestrator:
    """
    Coordinates the pipeline after discovery is complete:
    Chaos Injection → Analysis → Fix Generation → Review → GitHub PRs

    Discovery happens before the orchestrator runs —
    in the API layer via the DiscoveryAgent.
    """

    def __init__(self, db: AsyncSession, session_id: str):
        self.db = db
        self.session_id = session_id

    def _fix_identity(self, fix: dict) -> tuple[str, str, str, str]:
        """Stable identity so revised fixes replace originals, not append."""
        endpoints = fix.get("affected_endpoints", []) or []
        endpoint_key = ",".join(sorted(str(ep) for ep in endpoints))
        return (
            str(fix.get("file_path", "")),
            endpoint_key,
            str(fix.get("finding_title", "")),
            str(fix.get("severity", "")),
        )

    def _merge_revised_fixes(
        self,
        validated_fixes: list[dict],
        rejected_fixes: list[dict],
        revised_fixes: list[dict],
    ) -> list[dict]:
        """
        Merge revised fixes by identity:
        - keep already validated fixes unchanged
        - replace each rejected fix with its revised counterpart if present
          and the revised fix is not itself blocked (validation_failed)
        - if a revised fix cannot be matched, include it once (no duplicate append)

        A revised fix that carries validation_failed is not promoted — the
        original rejected fix is kept with its needs_review status so the
        next review round or the final exclusion logic can handle it.
        """
        _BLOCKED = {FixStatus.VALIDATION_FAILED.value}

        revised_by_id = {
            self._fix_identity(fx): fx
            for fx in revised_fixes
        }
        rejected_ids = {self._fix_identity(fx) for fx in rejected_fixes}

        merged: list[dict] = list(validated_fixes)
        used_ids: set = set()

        for old_fix in rejected_fixes:
            identity = self._fix_identity(old_fix)
            replacement = revised_by_id.get(identity)
            if replacement and replacement.get("status") not in _BLOCKED:
                merged.append(replacement)
                used_ids.add(identity)
            else:
                # Revision was blocked or missing — keep original so it
                # surfaces in the next review round or unresolved_fixes.
                merged.append(old_fix)
                if replacement:
                    logger.warning(
                        f"[Orchestrator] Revised fix for "
                        f"{old_fix.get('affected_endpoints')} is still "
                        f"validation_failed — keeping original for re-review."
                    )

        for identity, revised in revised_by_id.items():
            if identity not in used_ids and identity not in rejected_ids:
                if revised.get("status") not in _BLOCKED:
                    merged.append(revised)

        return merged

    async def run_from_endpoints(
        self,
        target_url: str,
        endpoints: list[dict],
        github_repo: str = None,
        github_token: str = None,
    ) -> dict:
        logger.info(
            f"[Orchestrator] Starting with {len(endpoints)} endpoints "
            f"for {target_url}"
        )

        import asyncio

        try:
            # ── Stage 1: Chaos Injection (180s timeout) ───────────────────────
            await ws_manager.emit_status(
                self.session_id, "injecting",
                f"Injecting failures into {len(endpoints)} endpoints..."
            )
            chaos = ChaosAgent(self.db, self.session_id, target_url)
            try:
                failure_results = await asyncio.wait_for(chaos.handle(endpoints), timeout=180.0)
            except asyncio.TimeoutError:
                logger.error(f"[Orchestrator] Chaos injection timed out after 180s for session {self.session_id}")
                raise TimeoutError("Chaos injection timed out after 180s.")
            finally:
                await chaos.close()

            unhandled = [r for r in failure_results if r["result"] == "unhandled"]
            logger.info(
                f"[Orchestrator] {len(failure_results)} injected, "
                f"{len(unhandled)} unhandled"
            )

            session = await self.db.get(ChaosSession, self.session_id)
            if session:
                session.unhandled_count = len(unhandled)
                await self.db.flush()

            # ── Stage 2: Analysis (90s timeout) ───────────────────────────────
            await ws_manager.emit_status(
                self.session_id, "analysing",
                "Analysing failure patterns..."
            )
            analyst = AnalystAgent(self.db, self.session_id)
            try:
                analysis = await asyncio.wait_for(analyst.handle(failure_results), timeout=90.0)
            except asyncio.TimeoutError:
                logger.error(f"[Orchestrator] Analysis stage timed out after 90s for session {self.session_id}")
                raise TimeoutError("Failure analysis timed out after 90s.")

            # ── Stage 3: Fix Generation (360s timeout) ─────────────────────────
            await ws_manager.emit_status(
                self.session_id, "fixing",
                "Generating error handling code..."
            )
            effective_token = github_token or settings.github_token
            fixer = FixAgent(
                self.db, self.session_id,
                repo_url=github_repo,
                github_token=effective_token
            )
            try:
                fix_result = await asyncio.wait_for(
                    fixer.handle(analysis, failure_results),
                    timeout=360.0
                )
            except asyncio.TimeoutError:
                logger.warning(
                    f"[Orchestrator] Fix generation timed out after 360s for session {self.session_id} "
                    f"— recovering {len(getattr(fixer, 'fixes', []))} fix(es) generated before timeout."
                )
                try:
                    await self.db.rollback()
                except Exception:
                    pass
                recovered_fixes = getattr(fixer, "fixes", [])
                applied = [f for f in recovered_fixes if f.get("status") != FixStatus.VALIDATION_FAILED.value]
                blocked = [f for f in recovered_fixes if f.get("status") == FixStatus.VALIDATION_FAILED.value]
                fix_result = {
                    "fixes": applied,
                    "fixes_count": len(applied),
                    "skipped_fixes": blocked,
                    "global_fixes": getattr(fixer, "global_fixes", []),
                }

            # ── Stage 3.5: Fix Review (150s timeout) ──────────────────────────
            if github_repo and effective_token and fix_result.get("fixes"):
                await ws_manager.emit_status(
                    self.session_id, "reviewing",
                    "Senior code review of generated fixes..."
                )
                reviewer = ReviewAgent(
                    self.db, self.session_id,
                    repo_url=github_repo,
                    github_token=effective_token,
                )

                try:
                    review_outcome = await asyncio.wait_for(
                        reviewer.handle(fix_result),
                        timeout=90.0
                    )
                    fix_result = review_outcome
                except asyncio.TimeoutError:
                    logger.warning("[Orchestrator] Code review timed out — proceeding with generated fixes.")
                except Exception as rev_err:
                    logger.warning(f"[Orchestrator] Code review error: {rev_err} — proceeding with generated fixes.")

                needs_revision = fix_result.get("needs_revision", [])
                if needs_revision:
                    logger.info(f"[Orchestrator] Review identified suggestions for {len(needs_revision)} fix(es)")
                    await ws_manager.emit_status(
                        self.session_id, "fixing",
                        f"Refining {len(needs_revision)} fix(es) based on review feedback..."
                    )

                    revised_fixer = FixAgent(
                        self.db, self.session_id,
                        repo_url=github_repo,
                        github_token=effective_token
                    )
                    try:
                        revised_fixes = await asyncio.wait_for(
                            revised_fixer.revise_fixes(needs_revision),
                            timeout=120.0
                        )
                    except asyncio.TimeoutError:
                        logger.warning("[Orchestrator] Fix revision timed out — keeping original fixes.")
                        revised_fixes = []
                    except Exception as rev_fx_err:
                        logger.warning(f"[Orchestrator] Fix revision error: {rev_fx_err} — keeping original fixes.")
                        revised_fixes = []

                    fix_result["fixes"] = self._merge_revised_fixes(
                        validated_fixes=fix_result.get("fixes", []),
                        rejected_fixes=needs_revision,
                        revised_fixes=revised_fixes,
                    )
                    fix_result.pop("needs_revision", None)

                # Ensure every non-blocked fix has an eligible status for GitHubAgent
                for fx in fix_result.get("fixes", []):
                    if fx.get("status") not in {FixStatus.VALIDATION_FAILED.value, FixStatus.VALIDATED.value}:
                        fx["status"] = FixStatus.GENERATED.value

                fix_result["fixes_count"] = len([
                    f for f in fix_result.get("fixes", [])
                    if f.get("status") != FixStatus.VALIDATION_FAILED.value
                ])

                review_stats = fix_result.get("review_stats", {})
                logger.info(
                    f"[Orchestrator] Review complete: {fix_result['fixes_count']} fix(es) ready for PR build validation."
                )

            # ── Stage 4: GitHub PRs (90s timeout) ─────────────────────────────
            prs_opened = []
            prs_skipped_count = 0
            if github_repo and effective_token:
                await ws_manager.emit_status(
                    self.session_id, "opening_prs",
                    f"Opening Pull Requests on {github_repo}..."
                )
                github = GitHubAgent(
                    self.db, self.session_id, github_repo,
                    github_token=effective_token,
                )
                try:
                    prs_opened = await asyncio.wait_for(
                        github.handle(
                            fixes_result=fix_result,
                            analysis=analysis,
                            report_id=fix_result.get("report_id"),
                        ),
                        timeout=300.0
                    )
                except asyncio.TimeoutError:
                    logger.error(f"[Orchestrator] GitHub PR creation timed out after 300s for session {self.session_id}")
                    await ws_manager.emit_status(
                        self.session_id, "github_skipped",
                        "GitHub PR creation timed out. Fix report is still available."
                    )
                    prs_opened = []

                for pr in prs_opened:
                    prs_skipped_count += pr.get("fixes_skipped", 0)
            elif github_repo and not effective_token:
                await ws_manager.emit_status(
                    self.session_id, "github_skipped",
                    "No GitHub token available — log in with GitHub or set GITHUB_TOKEN"
                )

            # ── Mark session complete in DB ────────────────────────────────
            session = await self.db.get(ChaosSession, self.session_id)
            if session:
                session.status = SessionStatus.COMPLETE
                session.prs_opened = len(prs_opened)
                session.risk_score = analysis.get("risk_score", 0)
                from datetime import datetime
                session.completed_at = datetime.utcnow()
                await self.db.flush()

                # Dispatch completion notification email if user has email configured
                if session.user_id:
                    try:
                        from backend.db.models import User
                        from backend.core.email_service import send_chaos_scan_complete_email
                        user = await self.db.get(User, session.user_id)
                        if user and user.email and getattr(user, "email_alerts_enabled", True):
                            await send_chaos_scan_complete_email(
                                to_email=user.email,
                                target_name=session.target_name or "API Target",
                                session_id=self.session_id,
                                risk_score=analysis.get("risk_score", 0),
                                unhandled_count=len(unhandled),
                                prs_opened=len(prs_opened),
                                report_id=fix_result.get("report_id"),
                            )
                    except Exception as email_err:
                        logger.warning(f"[Orchestrator] Could not dispatch scan complete email: {email_err}")

            total_skipped = (
                len(fix_result.get("skipped_fixes", []))
                + prs_skipped_count
            )

            await ws_manager.emit_status(
                self.session_id, "complete",
                f"Done. Risk score: {analysis.get('risk_score', 0)}/100 | "
                f"{len(prs_opened)} PR(s) opened"
                + (f" | {total_skipped} fix(es) skipped" if total_skipped else "")
            )

            if fix_result.get("report_id"):
                await ws_manager.emit_report_ready(
                    self.session_id,
                    fix_result["report_id"]
                )

            return {
                "session_id": self.session_id,
                "report_id": fix_result.get("report_id"),
                "endpoints_tested": len(endpoints),
                "failures_injected": len(failure_results),
                "unhandled_count": len(unhandled),
                "fixes_generated": fix_result.get("fixes_count", 0),
                "fixes_skipped": total_skipped,
                "risk_score": analysis.get("risk_score", 0),
                "prs_opened": len(prs_opened),
            }

        except Exception as e:
            logger.error(f"[Orchestrator] Pipeline failed: {e}")
            try:
                await self.db.rollback()
            except Exception:
                pass
            try:
                session = await self.db.get(ChaosSession, self.session_id)
                if session:
                    session.status = SessionStatus.FAILED
                    await self.db.flush()
            except Exception as db_err:
                logger.warning(f"[Orchestrator] Could not update session status to FAILED: {db_err}")
            await ws_manager.emit_status(self.session_id, "failed", str(e))
            raise
