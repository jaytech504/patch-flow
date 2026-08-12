"""
Monitored Sites API — Phase 4.

Endpoints:
  GET    /api/sites          — list user's monitored sites
  POST   /api/sites          — connect a new site
  PATCH  /api/sites/{id}     — update site settings
  DELETE /api/sites/{id}     — disconnect a site
  GET    /api/sites/sentry-projects — list Sentry projects for the org
"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.core.config import get_settings
from backend.db.models import MonitoredSite, User
from backend.db.session import get_db

router = APIRouter()
settings = get_settings()


# ── Schemas ───────────────────────────────────────────────────────────────────

class SiteCreate(BaseModel):
    name: str
    url: str | None = None
    github_repo: str | None = None
    sentry_project_slug: str | None = None
    sentry_org: str | None = None
    framework: str | None = None


class SiteUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    github_repo: str | None = None
    sentry_project_slug: str | None = None
    framework: str | None = None
    active: bool | None = None


def _site_to_dict(site: MonitoredSite) -> dict:
    return {
        "id": site.id,
        "name": site.name,
        "url": site.url,
        "github_repo": site.github_repo,
        "sentry_project_slug": site.sentry_project_slug,
        "sentry_org": site.sentry_org or settings.sentry_org,
        "framework": site.framework,
        "active": site.active,
        "created_at": site.created_at.isoformat() if site.created_at else None,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
async def list_sites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MonitoredSite)
        .where(MonitoredSite.user_id == current_user.id)
        .order_by(MonitoredSite.created_at.desc())
    )
    sites = result.scalars().all()
    return {"sites": [_site_to_dict(s) for s in sites]}


@router.post("")
async def create_site(
    body: SiteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    site = MonitoredSite(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=body.name,
        url=body.url,
        github_repo=body.github_repo,
        sentry_project_slug=body.sentry_project_slug,
        sentry_org=body.sentry_org or settings.sentry_org,
        framework=body.framework,
        active=True,
        created_at=datetime.utcnow(),
    )
    db.add(site)
    await db.flush()
    return _site_to_dict(site)


@router.patch("/{site_id}")
async def update_site(
    site_id: str,
    body: SiteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    site = await db.get(MonitoredSite, site_id)
    if not site or site.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Site not found.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(site, field, value)
    site.updated_at = datetime.utcnow()
    await db.flush()
    return _site_to_dict(site)


@router.delete("/{site_id}")
async def delete_site(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    site = await db.get(MonitoredSite, site_id)
    if not site or site.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Site not found.")
    await db.delete(site)
    await db.flush()
    return {"deleted": site_id}


@router.get("/sentry-projects")
async def list_sentry_projects(
    current_user: User = Depends(get_current_user),
):
    """List Sentry projects available in the configured org."""
    from backend.core.sentry_client import SentryClient
    if not settings.sentry_auth_token or not settings.sentry_org:
        return {"projects": []}
    client = SentryClient(settings.sentry_auth_token, settings.sentry_org)
    projects = await client.list_projects()
    return {"projects": projects}
