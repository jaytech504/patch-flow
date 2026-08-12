"""
Incident Pipeline — Phase 4.

Orchestrates the full flow for one Sentry incident:

  1. Deduplication  — one run per (sentry_issue_id + release)
  2. Threshold gate — skip if below min event/user count
  3. Env filter     — skip non-production environments
  4. Blocklist      — skip auth/billing/payments/security files
  5. Release map    — require a commit SHA before patching
  6. Fetch + redact — get issue, event, stack frames via Sentry API
  7. Fix generation — run FixAgent with incident context
  8. Review         — ReviewAgent validates the fix
  9. PR creation    — GitHubAgent opens a DRAFT PR
 10. Persist        — save SentryIncident record with outcome
"""

from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.core.redactor import redact_dict, redact_string
from backend.core.sentry_client import SentryClient
from backend.db.models import IncidentStatus, MonitoredSite, SentryIncident

settings = get_settings()

# ── Hard blocklist ────────────────────────────────────────────────────────────
# Files/modules matching any of these patterns are never auto-patched.
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


class IncidentPipeline:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._client = SentryClient(
            auth_token=settings.sentry_auth_token,
            org=settings.sentry_org,
        ) if settings.sentry_auth_token and settings.sentry_org else None

    async def run(self, issue_id: str, issue_data: dict, event_type: str) -> SentryIncident:
        """
        Execute the full incident pipeline.
        Always persists a SentryIncident record regardless of outcome.
        """
        incident_id = str(uuid.uuid4())
        incident = SentryIncident(
            id=incident_id,
            sentry_issue_id=issue_id,
            sentry_issue_url=issue_data.get("permalink", ""),
            sentry_project=issue_data.get("project", {}).get("slug", "") if isinstance(issue_data.get("project"), dict) else str(issue_data.get("project", "")),
            status=IncidentStatus.RECEIVED,
            created_at=datetime.utcnow(),
            dedup_key=f"{issue_id}:__pending__",  # updated after release fetch
        )
        self.db.add(incident)
        await self.db.flush()

        try:
            result = await self._execute(incident, issue_id, issue_data)
            return result
        except Exception as e:
            logger.error(f"[Incident] Pipeline error for issue {issue_id}: {e}")
            incident.status = IncidentStatus.FAILED
            incident.skip_reason = f"Pipeline error: {str(e)[:300]}"
            incident.processed_at = datetime.utcnow()
            await self.db.flush()
            return incident

    async def _execute(self, incident: SentryIncident, issue_id: str, issue_data: dict) -> SentryIncident:
        incident.status = IncidentStatus.PROCESSING
        await self.db.flush()

        if not self._client:
            return await self._skip(incident, "Sentry credentials not configured.")

        # ── 1. Fetch full issue from Sentry API ───────────────────────────────
        logger.info(f"[Incident] Fetching issue {issue_id} from Sentry...")
        try:
            issue = await self._client.get_issue(issue_id)
        except Exception as e:
            return await self._skip(incident, f"Could not fetch issue: {e}")

        incident.error_title = redact_string(issue.get("title", ""))[:500]
        incident.culprit = redact_string(issue.get("culprit", ""))[:500]
        incident.event_count = issue.get("count", 0)
        incident.user_count = issue.get("user_count", 0)
        incident.sentry_project = issue.get("project", "")
        await self.db.flush()

        # ── 2. Threshold gate ─────────────────────────────────────────────────
        if incident.event_count < settings.incident_min_events:
            return await self._skip(
                incident,
                f"Below event threshold ({incident.event_count} < {settings.incident_min_events})."
            )
        if incident.user_count < settings.incident_min_users:
            return await self._skip(
                incident,
                f"Below user threshold ({incident.user_count} < {settings.incident_min_users})."
            )

        # ── 3. Fetch latest event + stack frames ──────────────────────────────
        logger.info(f"[Incident] Fetching latest event for issue {issue_id}...")
        try:
            event = await self._client.get_latest_event(issue_id)
        except Exception as e:
            return await self._skip(incident, f"Could not fetch event: {e}")

        # ── 4. Environment filter ─────────────────────────────────────────────
        env = (event.get("environment") or "").lower()
        incident.environment = env
        allowed_envs = settings.incident_env_list
        if allowed_envs and env and env not in allowed_envs:
            return await self._skip(
                incident,
                f"Environment '{env}' not in monitored environments: {allowed_envs}."
            )

        # ── 5. Extract top stack frame ────────────────────────────────────────
        top_frame = event.get("top_frame") or {}
        stack_file = top_frame.get("filename", "") or top_frame.get("abs_path", "")
        stack_lineno = top_frame.get("lineno")
        stack_function = top_frame.get("function", "")

        incident.stack_file = stack_file[:500] if stack_file else None
        incident.stack_lineno = stack_lineno
        incident.stack_function = stack_function[:300] if stack_function else None
        incident.error_type = event.get("error_type", "")[:200]
        await self.db.flush()

        # ── 6. Blocklist check ────────────────────────────────────────────────
        blocked, block_reason = _is_blocked(stack_file, stack_function)
        if blocked:
            return await self._skip(incident, f"Blocklisted: {block_reason}")

        # ── 7. Release + commit mapping ───────────────────────────────────────
        release_version = event.get("release", "")
        incident.sentry_release = release_version

        commit_sha = ""
        if release_version:
            logger.info(f"[Incident] Fetching release {release_version}...")
            try:
                release_info = await self._client.get_release(
                    incident.sentry_project, release_version
                )
                commit_sha = (release_info or {}).get("commit_sha", "")
            except Exception as e:
                logger.warning(f"[Incident] Could not fetch release: {e}")

        # Update dedup key now that we have the release
        dedup_key = f"{issue_id}:{release_version or 'unknown'}"
        incident.dedup_key = dedup_key
        await self.db.flush()

        # ── 8. Deduplication check ────────────────────────────────────────────
        existing = await self.db.execute(
            select(SentryIncident).where(
                SentryIncident.dedup_key == dedup_key,
                SentryIncident.id != incident.id,
                SentryIncident.status.in_([
                    IncidentStatus.PROCESSING,
                    IncidentStatus.PR_OPENED,
                ])
            )
        )
        if existing.scalar_one_or_none():
            return await self._skip(
                incident,
                f"Duplicate: issue {issue_id} + release '{release_version}' already processed."
            )

        # ── 9. Find matching monitored site for repo + token ──────────────────
        site = await self._find_site(incident.sentry_project)
        github_repo = (site.github_repo if site else None)
        github_token = None
        if site and site.user_id:
            from backend.db.models import User
            user = await self.db.get(User, site.user_id)
            if user:
                github_token = user.github_access_token

        incident.site_id = site.id if site else None
        incident.github_repo = github_repo
        await self.db.flush()

        if not github_repo:
            return await self._skip(
                incident,
                "No monitored site with a GitHub repo linked to this Sentry project."
            )

        if not commit_sha:
            return await self._skip(
                incident,
                f"Release '{release_version}' has no commit SHA — cannot map to repository."
            )

        # ── 10. Build finding context for FixAgent ────────────────────────────
        finding = {
            "title": incident.error_title or "Unhandled production error",
            "severity": "CRITICAL" if incident.user_count > 5 else "HIGH",
            "affected_endpoints": [event.get("request", {}).get("url", "") or incident.culprit or stack_file],
            "failure_modes": ["unhandled_exception"],
            "evidence": (
                f"Error: {incident.error_type} — {event.get('error_value', '')}\n"
                f"File: {stack_file}:{stack_lineno} in {stack_function}\n"
                f"Sentry events: {incident.event_count}, users affected: {incident.user_count}"
            ),
        }
        analysis = {
            "risk_score": min(50 + incident.user_count * 5, 100),
            "summary": f"Production incident: {incident.error_title}",
            "critical_findings": [finding],
            "all_findings": [finding],
            "patterns": [f"Unhandled {incident.error_type} in {stack_file}"],
        }

        # ── 11. Run FixAgent ──────────────────────────────────────────────────
        logger.info(f"[Incident] Running FixAgent for issue {issue_id}...")
        from backend.agents.fix_agent import FixAgent
        fixer = FixAgent(
            db=self.db,
            session_id=incident.id,    # use incident ID as session_id for agent steps
            repo_url=f"https://github.com/{github_repo}",
            github_token=github_token,
        )

        # Patch the analysis dict to match what FixAgent.handle() expects
        fake_failure_results = [{
            "id": str(uuid.uuid4()),
            "endpoint_path": finding["affected_endpoints"][0],
            "failure_mode": "unhandled_exception",
            "result": "unhandled",
            "error_leaked": True,
            "status_code": 500,
        }]

        fix_result = await fixer.handle(analysis, fake_failure_results)

        # ── 12. Run ReviewAgent (if we have a valid fix) ──────────────────────
        if fix_result.get("fixes") and github_repo and github_token:
            logger.info(f"[Incident] Running ReviewAgent for issue {issue_id}...")
            from backend.agents.review_agent import ReviewAgent
            reviewer = ReviewAgent(
                db=self.db,
                session_id=incident.id,
                repo_url=f"https://github.com/{github_repo}",
                github_token=github_token,
            )
            fix_result = await reviewer.handle(fix_result)

        # ── 13. Open draft PR via GitHubAgent ─────────────────────────────────
        prs = []
        if fix_result.get("fixes") and github_repo and github_token:
            logger.info(f"[Incident] Opening draft PR for issue {issue_id}...")
            from backend.agents.github_agent import GitHubAgent
            gh = GitHubAgent(
                db=self.db,
                session_id=incident.id,
                repo_url=github_repo,
                github_token=github_token,
            )
            # Inject incident metadata into the PR description context
            fix_result["incident_context"] = {
                "sentry_issue_url": incident.sentry_issue_url,
                "error_title": incident.error_title,
                "environment": incident.environment,
                "event_count": incident.event_count,
                "user_count": incident.user_count,
            }
            prs = await gh.handle(
                fixes_result=fix_result,
                analysis=analysis,
                report_id=fix_result.get("report_id"),
            )

        # ── 14. Persist outcome ───────────────────────────────────────────────
        if prs:
            pr = prs[0]
            incident.status = IncidentStatus.PR_OPENED
            incident.pr_url = pr.get("pr_url", "")
            incident.pr_number = pr.get("pr_number")
            incident.fix_summary = (
                f"{fix_result.get('fixes_count', 0)} fix(es) applied. "
                f"PR: {pr.get('pr_url', '')}"
            )
            logger.info(f"[Incident] Draft PR opened: {incident.pr_url}")
        else:
            incident.status = IncidentStatus.SKIPPED
            incident.skip_reason = "Fix generation completed but no eligible fixes for PR."

        incident.processed_at = datetime.utcnow()
        await self.db.flush()
        return incident

    async def _skip(self, incident: SentryIncident, reason: str) -> SentryIncident:
        logger.info(f"[Incident] Skipped issue {incident.sentry_issue_id}: {reason}")
        incident.status = IncidentStatus.SKIPPED
        incident.skip_reason = reason[:500]
        incident.processed_at = datetime.utcnow()
        await self.db.flush()
        return incident

    async def _find_site(self, sentry_project: str) -> MonitoredSite | None:
        """Find the best matching monitored site for a Sentry project slug."""
        if not sentry_project:
            return None
        result = await self.db.execute(
            select(MonitoredSite).where(
                MonitoredSite.sentry_project_slug == sentry_project,
                MonitoredSite.active == True,  # noqa: E712
            )
        )
        return result.scalar_one_or_none()
