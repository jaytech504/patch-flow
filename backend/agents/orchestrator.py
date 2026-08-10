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

        try:
            # ── Stage 1: Chaos Injection ──────────────────────────────────────
            await ws_manager.emit_status(
                self.session_id, "injecting",
                f"Injecting failures into {len(endpoints)} endpoints..."
            )
            chaos = ChaosAgent(self.db, self.session_id, target_url)
            failure_results = await chaos.handle(endpoints)
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

            # ── Stage 2: Analysis ─────────────────────────────────────────────
            await ws_manager.emit_status(
                self.session_id, "analysing",
                "Analysing failure patterns..."
            )
            analyst = AnalystAgent(self.db, self.session_id)
            analysis = await analyst.handle(failure_results)

            # ── Stage 3: Fix Generation ───────────────────────────────────────
            await ws_manager.emit_status(
                self.session_id, "fixing",
                "Generating error handling code..."
            )
            # Resolve token: per-user OAuth token > global fallback
            effective_token = github_token or settings.github_token
            fixer = FixAgent(
                self.db, self.session_id,
                repo_url=github_repo,
                github_token=effective_token
            )
            fix_result = await fixer.handle(analysis, failure_results)

            # ── Stage 3.5: Fix Review ─────────────────────────────────────────
            # ReviewAgent validates each fix like a senior developer.
            # If fixes need revision, they go back to FixAgent for correction.
            if github_repo and effective_token:
                await ws_manager.emit_status(
                    self.session_id, "reviewing",
                    "Senior code review of generated fixes..."
                )
                reviewer = ReviewAgent(
                    self.db, self.session_id,
                    repo_url=github_repo,
                    github_token=effective_token,
                )

                max_review_rounds = 2
                for review_round in range(max_review_rounds):
                    fix_result = await reviewer.handle(fix_result)

                    needs_revision = fix_result.get("needs_revision", [])
                    if not needs_revision:
                        logger.info(
                            f"[Orchestrator] Review round {review_round + 1}: "
                            f"all fixes validated ✓"
                        )
                        break

                    logger.info(
                        f"[Orchestrator] Review round {review_round + 1}: "
                        f"{len(needs_revision)} fix(es) need revision"
                    )
                    await ws_manager.emit_status(
                        self.session_id, "fixing",
                        f"Revising {len(needs_revision)} fix(es) based on review feedback..."
                    )

                    revised_fixer = FixAgent(
                        self.db, self.session_id,
                        repo_url=github_repo,
                        github_token=effective_token
                    )
                    revised_fixes = await revised_fixer.revise_fixes(needs_revision)

                    # Merge revisions by identity — status-aware so
                    # validation_failed revisions don't displace good fixes.
                    fix_result["fixes"] = self._merge_revised_fixes(
                        validated_fixes=fix_result.get("fixes", []),
                        rejected_fixes=needs_revision,
                        revised_fixes=revised_fixes,
                    )
                    fix_result["fixes_count"] = len([
                        f for f in fix_result["fixes"]
                        if f.get("status") not in {FixStatus.VALIDATION_FAILED.value}
                    ])

                    # Clear the needs_revision list for the next review round
                    fix_result.pop("needs_revision", None)

                    await ws_manager.emit_status(
                        self.session_id, "reviewing",
                        f"Re-reviewing revised fixes (round {review_round + 2})..."
                    )
                else:
                    # Max rounds reached — exclude any fixes still needing revision.
                    remaining = fix_result.pop("needs_revision", [])
                    if remaining:
                        logger.warning(
                            f"[Orchestrator] Max review rounds reached. "
                            f"{len(remaining)} fix(es) still need revision — excluded."
                        )
                        # Carry them as unresolved so the report can show them
                        existing_skipped = fix_result.get("skipped_fixes", [])
                        fix_result["skipped_fixes"] = existing_skipped + remaining
                        fix_result["fixes_count"] = len(fix_result.get("fixes", []))

                review_stats = fix_result.get("review_stats", {})
                logger.info(
                    f"[Orchestrator] Review complete: "
                    f"{review_stats.get('validated', 0)} validated, "
                    f"{review_stats.get('revision_needed', 0)} revised"
                )

            # ── Stage 4: GitHub PRs ───────────────────────────────────────────
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
                prs_opened = await github.handle(
                    fixes_result=fix_result,
                    analysis=analysis,
                    report_id=fix_result.get("report_id"),
                )
                # Accumulate PR-level skip count for the summary
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

            # Total skipped = validation_failed + needs_review (unresolved) + pr_skipped
            total_skipped = (
                len(fix_result.get("skipped_fixes", []))
                + prs_skipped_count
            )

            # Emit "complete" status first so the stage bar updates,
            # then "report_ready" which triggers the completion modal.
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
            session = await self.db.get(ChaosSession, self.session_id)
            if session:
                session.status = SessionStatus.FAILED
                await self.db.flush()
            await ws_manager.emit_status(self.session_id, "failed", str(e))
            raise
