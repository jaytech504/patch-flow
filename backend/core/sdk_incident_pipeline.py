"""
SDK Incident Pipeline — triggered when the PatchFlow Agent SDK
reports enough occurrences of the same error.

Flow:
  1. Load the SdkError record + MonitoredSite
  2. Blocklist check (auth/billing/payments/security files)
  3. Build finding context from the real stack frame
  4. FixAgent → ReviewAgent → GitHubAgent
  5. Persist outcome as an Incident record
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import IncidentStatus, MonitoredSite, SdkError, Incident, User, ChaosSession, SessionStatus

# ── Hard blocklist ─────────────────────────────────────────────────────────────
# Files/modules matching these patterns are never auto-patched.
_BLOCKLIST_PATTERNS = [
    "auth", "authoriz", "login", "oauth", "jwt", "session",
    "billing", "payment", "stripe", "checkout", "invoice", "subscription",
    "migration", "alembic", "schema",
    "secret", "credential", "password", "crypto", "encrypt",
    "admin", "superuser", "permission", "role",
]


def _is_blocked(file_path: str, function_name: str) -> tuple[bool, str]:
    """Return (True, reason) if this stack frame matches the blocklist."""
    combined = (file_path + " " + function_name).lower()
    for pattern in _BLOCKLIST_PATTERNS:
        if pattern in combined:
            return True, f"Blocklisted pattern '{pattern}' found in '{file_path}'"
    return False, ""


class SdkIncidentPipeline:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def run(self, sdk_error_id: str, occurrence_count: int) -> Incident | None:
        """
        Run the fix pipeline for a real production error captured by the SDK.
        Returns the Incident record (used for dedup and UI display).
        """
        # ── Load error + site ─────────────────────────────────────────────────
        sdk_error = await self.db.get(SdkError, sdk_error_id)
        if not sdk_error:
            logger.error(f"[SdkPipeline] SdkError {sdk_error_id} not found.")
            return None

        site = await self.db.get(MonitoredSite, sdk_error.site_id)
        if not site or not site.active:
            logger.warning(f"[SdkPipeline] Site {sdk_error.site_id} not found or inactive.")
            return None

        logger.info(
            f"[SdkPipeline] Processing {sdk_error.error_type} @ "
            f"{sdk_error.stack_file}:{sdk_error.stack_lineno} "
            f"— site={site.name} occurrences={occurrence_count}"
        )

        # ── Dedup check ───────────────────────────────────────────────────────
        # Use the fingerprint as dedup_key so the same error+location
        # doesn't spawn multiple incidents.
        dedup_key = f"sdk:{sdk_error.fingerprint}"
        existing = await self.db.execute(
            select(Incident).where(Incident.dedup_key == dedup_key)
        )
        existing_incident = existing.scalar_one_or_none()

        if existing_incident:
            if existing_incident.status in (IncidentStatus.PROCESSING, IncidentStatus.PR_OPENED):
                logger.info(f"[SdkPipeline] Duplicate — already active incident for {sdk_error.fingerprint[:16]}…")
                return existing_incident

            # Re-use and reset the existing incident for re-processing
            incident = existing_incident
            incident.status = IncidentStatus.PROCESSING
            incident.skip_reason = None
            incident.event_count = occurrence_count
            incident.processed_at = None
            incident.error_title = f"{sdk_error.error_type}: {(sdk_error.error_message or '')[:200]}"
            incident.culprit = sdk_error.culprit or sdk_error.endpoint or sdk_error.stack_file or ""
            incident.stack_file = sdk_error.stack_file
            incident.stack_lineno = sdk_error.stack_lineno
            incident.stack_function = sdk_error.stack_function

            # Ensure matching ChaosSession exists for FK integrity
            session = await self.db.get(ChaosSession, incident.id)
            if not session:
                session = ChaosSession(
                    id=incident.id,
                    target_url=site.name or "production",
                    target_name=site.name,
                    github_repo=site.github_repo,
                    user_id=site.user_id,
                    status=SessionStatus.FIXING,
                    created_at=datetime.utcnow(),
                )
                self.db.add(session)
        else:
            # ── Create chaos session & incident records ───────────────────────────
            incident_id = str(uuid.uuid4())

            session = ChaosSession(
                id=incident_id,
                target_url=site.name or "production",
                target_name=site.name,
                github_repo=site.github_repo,
                user_id=site.user_id,
                status=SessionStatus.FIXING,
                created_at=datetime.utcnow(),
            )
            self.db.add(session)

            incident = Incident(
                id=incident_id,
                site_id=site.id,
                sentry_issue_id=f"sdk_{sdk_error_id}",
                sentry_project=site.name,
                dedup_key=dedup_key,
                error_title=f"{sdk_error.error_type}: {(sdk_error.error_message or '')[:200]}",
                error_type=sdk_error.error_type,
                culprit=sdk_error.culprit or sdk_error.endpoint or sdk_error.stack_file or "",
                stack_file=sdk_error.stack_file,
                stack_lineno=sdk_error.stack_lineno,
                stack_function=sdk_error.stack_function,
                environment=sdk_error.environment or "production",
                event_count=occurrence_count,
                user_count=1,
                github_repo=site.github_repo,
                status=IncidentStatus.PROCESSING,
                created_at=datetime.utcnow(),
            )
            self.db.add(incident)

        # Link the sdk_error to this incident
        sdk_error.incident_id = incident.id
        await self.db.commit()

        try:
            await self._execute(incident, sdk_error, site)
            await self.db.commit()
        except Exception as e:
            logger.error(f"[SdkPipeline] Pipeline failed: {e}")
            await self.db.rollback()
            inc = await self.db.get(Incident, incident_id)
            if inc:
                inc.status = IncidentStatus.FAILED
                inc.skip_reason = f"Pipeline error: {str(e)[:300]}"
                inc.processed_at = datetime.utcnow()
                await self.db.commit()

        return incident

    async def _execute(
        self,
        incident: Incident,
        sdk_error: SdkError,
        site: MonitoredSite,
    ) -> None:
        # ── Blocklist check ───────────────────────────────────────────────────
        blocked, reason = _is_blocked(
            sdk_error.stack_file or "",
            sdk_error.stack_function or "",
        )
        if blocked:
            await self._skip(incident, f"Blocklisted: {reason}")
            return

        # ── Require a GitHub repo ─────────────────────────────────────────────
        github_repo = site.github_repo
        if not github_repo:
            await self._skip(incident, "No GitHub repository linked to this site.")
            return

        # ── Get user's GitHub token ───────────────────────────────────────────
        github_token = None
        if site.user_id:
            user = await self.db.get(User, site.user_id)
            if user:
                github_token = user.github_access_token

        if not github_token:
            await self._skip(incident, "No GitHub token available for this site's owner.")
            return

        # ── Build rich finding context from the real stack frame ──────────────
        stack_frames = sdk_error.stack_frames or []
        frame_summary = ""
        if stack_frames:
            top = stack_frames[-1]
            frame_summary = (
                f"File: {top.get('filename', '')}:{top.get('lineno', '')} "
                f"in {top.get('function', '')}\n"
                f"Code: {top.get('context_line', '')}"
            )

        endpoint_label = sdk_error.endpoint or sdk_error.culprit or sdk_error.stack_file or "/unknown"

        finding = {
            "title": f"{sdk_error.error_type} in {sdk_error.stack_function or sdk_error.stack_file or 'handler'}",
            "severity": "CRITICAL" if incident.event_count >= 10 else "HIGH",
            "affected_endpoints": [endpoint_label],
            "failure_modes": ["unhandled_exception"],
            "evidence": (
                f"Real production error captured by PatchFlow SDK.\n"
                f"Error: {sdk_error.error_type} — {sdk_error.error_message or ''}\n"
                f"{frame_summary}\n"
                f"Occurrences: {incident.event_count} | Environment: {sdk_error.environment}"
            ),
        }
        analysis = {
            "risk_score": min(40 + incident.event_count * 3, 100),
            "summary": (
                f"Production error: {sdk_error.error_type} occurring "
                f"{incident.event_count}× in {sdk_error.environment}"
            ),
            "critical_findings": [finding],
            "all_findings": [finding],
            "patterns": [
                f"Unhandled {sdk_error.error_type} at "
                f"{sdk_error.stack_file}:{sdk_error.stack_lineno}"
            ],
        }

        # ── FixAgent ──────────────────────────────────────────────────────────
        logger.info(f"[SdkPipeline] Running FixAgent for incident {incident.id}…")
        from backend.agents.fix_agent import FixAgent
        fixer = FixAgent(
            db=self.db,
            session_id=incident.id,
            repo_url=f"https://github.com/{github_repo}",
            github_token=github_token,
        )
        fake_failure = [{
            "id": str(uuid.uuid4()),
            "endpoint_path": endpoint_label,
            "failure_mode": "unhandled_exception",
            "result": "unhandled",
            "error_leaked": True,
            "status_code": 500,
        }]
        fix_result = await fixer.handle(analysis, fake_failure)

        # ── ReviewAgent ───────────────────────────────────────────────────────
        if fix_result.get("fixes"):
            logger.info(f"[SdkPipeline] Running ReviewAgent for incident {incident.id}…")
            from backend.agents.review_agent import ReviewAgent
            reviewer = ReviewAgent(
                db=self.db,
                session_id=incident.id,
                repo_url=f"https://github.com/{github_repo}",
                github_token=github_token,
            )
            fix_result = await reviewer.handle(fix_result)

        # ── GitHubAgent — open draft PR ───────────────────────────────────────
        prs = []
        if fix_result.get("fixes"):
            logger.info(f"[SdkPipeline] Opening draft PR for incident {incident.id}…")
            from backend.agents.github_agent import GitHubAgent
            gh = GitHubAgent(
                db=self.db,
                session_id=incident.id,
                repo_url=github_repo,
                github_token=github_token,
            )
            # Inject incident context for the PR description
            fix_result["incident_context"] = {
                "error_type": sdk_error.error_type,
                "error_message": sdk_error.error_message,
                "stack_file": sdk_error.stack_file,
                "stack_lineno": sdk_error.stack_lineno,
                "endpoint": sdk_error.endpoint,
                "event_count": incident.event_count,
                "environment": sdk_error.environment,
            }
            prs = await gh.handle(
                fixes_result=fix_result,
                analysis=analysis,
                report_id=fix_result.get("report_id"),
            )

        # ── Persist outcome ───────────────────────────────────────────────────
        if prs:
            pr = prs[0]
            incident.status = IncidentStatus.PR_OPENED
            incident.pr_url = pr.get("pr_url", "")
            incident.pr_number = pr.get("pr_number")
            incident.fix_summary = (
                f"{fix_result.get('fixes_count', 0)} fix(es). "
                f"PR: {pr.get('pr_url', '')}"
            )
            logger.info(f"[SdkPipeline] Draft PR opened: {incident.pr_url}")
        else:
            await self._skip(
                incident,
                "Fix generated but no eligible fixes passed validation for PR.",
            )
            return

        incident.processed_at = datetime.utcnow()
        await self.db.flush()

    async def _skip(self, incident: Incident, reason: str) -> None:
        logger.info(f"[SdkPipeline] Skipped: {reason}")
        incident.status = IncidentStatus.SKIPPED
        incident.skip_reason = reason[:500]
        incident.processed_at = datetime.utcnow()
        await self.db.flush()
