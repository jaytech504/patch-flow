"""
Incidents API — Phase 4.
Lists Sentry-triggered incidents for the current user's monitored sites.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.db.models import MonitoredSite, SentryIncident, User
from backend.db.session import get_db

router = APIRouter()


def _incident_to_dict(inc: SentryIncident) -> dict:
    return {
        "id": inc.id,
        "site_id": inc.site_id,
        "sentry_issue_id": inc.sentry_issue_id,
        "sentry_issue_url": inc.sentry_issue_url,
        "sentry_project": inc.sentry_project,
        "sentry_release": inc.sentry_release,
        "error_title": inc.error_title,
        "error_type": inc.error_type,
        "culprit": inc.culprit,
        "stack_file": inc.stack_file,
        "stack_lineno": inc.stack_lineno,
        "stack_function": inc.stack_function,
        "environment": inc.environment,
        "event_count": inc.event_count,
        "user_count": inc.user_count,
        "status": inc.status.value if inc.status else "received",
        "skip_reason": inc.skip_reason,
        "pr_url": inc.pr_url,
        "pr_number": inc.pr_number,
        "github_repo": inc.github_repo,
        "fix_summary": inc.fix_summary,
        "created_at": inc.created_at.isoformat() if inc.created_at else None,
        "processed_at": inc.processed_at.isoformat() if inc.processed_at else None,
    }


@router.get("")
async def list_incidents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all incidents across all of the user's monitored sites."""
    # Get site IDs belonging to this user
    sites_result = await db.execute(
        select(MonitoredSite.id).where(MonitoredSite.user_id == current_user.id)
    )
    site_ids = [row[0] for row in sites_result.fetchall()]

    if not site_ids:
        return {"incidents": []}

    result = await db.execute(
        select(SentryIncident)
        .where(SentryIncident.site_id.in_(site_ids))
        .order_by(SentryIncident.created_at.desc())
        .limit(100)
    )
    incidents = result.scalars().all()
    return {"incidents": [_incident_to_dict(i) for i in incidents]}


@router.get("/{incident_id}")
async def get_incident(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single incident detail."""
    inc = await db.get(SentryIncident, incident_id)
    if not inc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Incident not found.")

    # Verify ownership via site
    if inc.site_id:
        site = await db.get(MonitoredSite, inc.site_id)
        if not site or site.user_id != current_user.id:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Incident not found.")

    return _incident_to_dict(inc)
