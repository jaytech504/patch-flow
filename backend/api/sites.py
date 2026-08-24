"""
Monitored Sites API — Phase 4.

Endpoints:
  GET    /api/sites                    — list user's monitored sites
  POST   /api/sites                    — connect a new site
  PATCH  /api/sites/{id}               — update site settings
  DELETE /api/sites/{id}               — disconnect a site
  POST   /api/sites/{id}/generate-key  — generate a new SDK API key
  DELETE /api/sites/{id}/keys/{key_id} — revoke an API key
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.core.config import get_settings
from backend.db.models import MonitoredSite, SiteApiKey, SdkError, Incident, User
from backend.db.session import get_db

router = APIRouter()
settings = get_settings()

_KEY_PREFIX = "pf_live_"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_raw_key() -> str:
    """Generate a new raw API key: pf_live_<32-hex-chars>"""
    return _KEY_PREFIX + secrets.token_hex(32)


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


# ── Schemas ───────────────────────────────────────────────────────────────────

class SiteCreate(BaseModel):
    name: str
    url: str | None = None
    github_repo: str | None = None
    framework: str | None = None


class SiteUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    github_repo: str | None = None
    framework: str | None = None
    active: bool | None = None


def _site_to_dict(site: MonitoredSite, api_keys: list[SiteApiKey] | None = None) -> dict:
    return {
        "id": site.id,
        "name": site.name,
        "url": site.url,
        "github_repo": site.github_repo,
        "framework": site.framework,
        "active": site.active,
        "sdk_status": site.sdk_status or "not_installed",
        "sdk_last_seen": site.sdk_last_seen.isoformat() if site.sdk_last_seen else None,
        "api_keys": [
            {
                "id": k.id,
                "prefix": k.key_prefix,
                "label": k.label,
                "active": k.active,
                "created_at": k.created_at.isoformat() if k.created_at else None,
                "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
            }
            for k in (api_keys or [])
        ],
        "created_at": site.created_at.isoformat() if site.created_at else None,
    }


async def _get_site_keys(site_id: str, db: AsyncSession) -> list[SiteApiKey]:
    result = await db.execute(
        select(SiteApiKey)
        .where(SiteApiKey.site_id == site_id)
        .order_by(SiteApiKey.created_at.desc())
    )
    return list(result.scalars().all())


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
    out = []
    for site in sites:
        keys = await _get_site_keys(site.id, db)
        out.append(_site_to_dict(site, keys))
    return {"sites": out}


from backend.core.billing_guards import can_create_site

@router.post("")
async def create_site(
    body: SiteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # ── Enforce tier site quota ───────────────────────────────────────────────
    count_res = await db.execute(
        select(MonitoredSite).where(MonitoredSite.user_id == current_user.id)
    )
    existing_count = len(count_res.scalars().all())

    allowed, err_msg = can_create_site(current_user, existing_count)
    if not allowed:
        raise HTTPException(status_code=403, detail=err_msg)

    site = MonitoredSite(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=body.name,
        url=body.url,
        github_repo=body.github_repo,
        framework=body.framework,
        active=True,
        sdk_status="not_installed",
        created_at=datetime.utcnow(),
    )
    db.add(site)
    await db.flush()

    # Auto-generate a first API key on creation
    raw_key = _generate_raw_key()
    key_record = SiteApiKey(
        id=str(uuid.uuid4()),
        site_id=site.id,
        key_hash=_hash_key(raw_key),
        key_prefix=raw_key[:16],   # "pf_live_" + first 8 hex chars
        label="Default key",
        active=True,
        created_at=datetime.utcnow(),
    )
    db.add(key_record)
    await db.flush()

    result = _site_to_dict(site, [key_record])
    # Return the raw key ONCE — it is never stored in plaintext
    result["api_key"] = raw_key
    result["api_key_id"] = key_record.id
    return result


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
    keys = await _get_site_keys(site_id, db)
    return _site_to_dict(site, keys)


@router.delete("/{site_id}")
async def delete_site(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    site = await db.get(MonitoredSite, site_id)
    if not site or site.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Site not found.")

    # Explicitly clean up all child records (SDK errors, incidents, API keys)
    await db.execute(delete(SdkError).where(SdkError.site_id == site_id))
    await db.execute(delete(Incident).where(Incident.site_id == site_id))
    await db.execute(delete(SiteApiKey).where(SiteApiKey.site_id == site_id))
    await db.delete(site)
    await db.commit()
    return {"deleted": site_id}


@router.post("/{site_id}/generate-key")
async def generate_api_key(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a new SDK API key for the site. Returns the raw key once."""
    site = await db.get(MonitoredSite, site_id)
    if not site or site.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Site not found.")

    raw_key = _generate_raw_key()
    key_record = SiteApiKey(
        id=str(uuid.uuid4()),
        site_id=site_id,
        key_hash=_hash_key(raw_key),
        key_prefix=raw_key[:16],
        label=f"Key {datetime.utcnow().strftime('%Y-%m-%d')}",
        active=True,
        created_at=datetime.utcnow(),
    )
    db.add(key_record)
    await db.flush()

    return {
        "api_key": raw_key,         # shown ONCE, never stored in plaintext
        "api_key_id": key_record.id,
        "prefix": key_record.key_prefix,
    }


@router.delete("/{site_id}/keys/{key_id}")
async def revoke_api_key(
    site_id: str,
    key_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke (deactivate) an SDK API key."""
    site = await db.get(MonitoredSite, site_id)
    if not site or site.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Site not found.")

    key_record = await db.get(SiteApiKey, key_id)
    if not key_record or key_record.site_id != site_id:
        raise HTTPException(status_code=404, detail="Key not found.")

    key_record.active = False
    await db.flush()
    return {"revoked": key_id}
