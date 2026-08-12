"""
PatchFlow Agent SDK ingestion endpoint.

POST /api/sdk/errors
  — receives error events from the PatchFlow Agent SDK installed in user apps
  — validates the API key
  — redacts PII from the payload
  — deduplicates by fingerprint
  — triggers the incident pipeline as a background task
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.redactor import redact_dict, redact_string, redact_stack_frame
from backend.db.models import MonitoredSite, SiteApiKey, SdkError
from backend.db.session import AsyncSessionLocal, get_db

router = APIRouter()

# How many times the same fingerprint must appear before triggering the pipeline
_MIN_OCCURRENCES = 3


# ── Payload schema ────────────────────────────────────────────────────────────

class StackFrame(BaseModel):
    filename: str = ""
    lineno: int | None = None
    function: str = ""
    context_line: str = ""
    pre_context: list[str] = []
    post_context: list[str] = []
    vars: dict[str, Any] = {}


class SdkErrorPayload(BaseModel):
    error_type: str = ""
    error_message: str = ""
    culprit: str = ""                   # endpoint path or function name
    endpoint: str = ""
    method: str = ""
    status_code: int | None = None
    stack_frames: list[StackFrame] = []
    framework: str = ""
    environment: str = "production"
    sdk_version: str = ""
    # Optional extra context
    extra: dict[str, Any] = {}


# ── API key validation ────────────────────────────────────────────────────────

def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


async def _validate_api_key(
    raw_key: str, db: AsyncSession
) -> tuple[SiteApiKey, MonitoredSite] | tuple[None, None]:
    """
    Look up the API key by its hash.
    Returns (key_record, site) or (None, None) if invalid/inactive.
    """
    key_hash = _hash_key(raw_key)
    result = await db.execute(
        select(SiteApiKey).where(
            SiteApiKey.key_hash == key_hash,
            SiteApiKey.active == True,  # noqa: E712
        )
    )
    key_record = result.scalar_one_or_none()
    if not key_record:
        return None, None

    site = await db.get(MonitoredSite, key_record.site_id)
    if not site or not site.active:
        return None, None

    return key_record, site


def _compute_fingerprint(site_id: str, error_type: str, stack_file: str, stack_lineno: int | None) -> str:
    """Stable dedup fingerprint: same error at same location = same fingerprint."""
    raw = f"{site_id}:{error_type}:{stack_file}:{stack_lineno or 0}"
    return hashlib.sha256(raw.encode()).hexdigest()


# ── Ingestion endpoint ────────────────────────────────────────────────────────

@router.post("/errors")
async def ingest_error(
    payload: SdkErrorPayload,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    x_patchflow_key: str | None = Header(None, alias="X-PatchFlow-Key"),
    authorization: str | None = Header(None),
):
    """
    Receive an error event from the PatchFlow Agent SDK.
    Accepts the API key via X-PatchFlow-Key header or Bearer token.
    """
    # Extract raw key from either header
    raw_key = x_patchflow_key
    if not raw_key and authorization and authorization.startswith("Bearer "):
        raw_key = authorization.removeprefix("Bearer ").strip()

    if not raw_key:
        raise HTTPException(status_code=401, detail="Missing API key.")

    key_record, site = await _validate_api_key(raw_key, db)
    if not key_record or not site:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key.")

    # Update key last-used timestamp
    key_record.last_used_at = datetime.utcnow()

    # Update site SDK status
    site.sdk_status = "active"
    site.sdk_last_seen = datetime.utcnow()
    await db.flush()

    # ── Redact PII from all text fields ───────────────────────────────────────
    error_type    = redact_string(payload.error_type)[:300]
    error_message = redact_string(payload.error_message)[:1000]
    culprit       = redact_string(payload.culprit)[:500]
    endpoint      = redact_string(payload.endpoint)[:500]

    # Redact stack frames
    safe_frames = [
        redact_stack_frame(f.model_dump()) for f in payload.stack_frames
    ]

    # Top frame = last in list (most specific)
    top_frame = safe_frames[-1] if safe_frames else {}
    stack_file     = top_frame.get("filename", "") or top_frame.get("abs_path", "")
    stack_lineno   = top_frame.get("lineno")
    stack_function = top_frame.get("function", "")

    # ── Compute dedup fingerprint ─────────────────────────────────────────────
    fingerprint = _compute_fingerprint(
        site.id, error_type, stack_file, stack_lineno
    )

    # ── Count existing occurrences for this fingerprint ───────────────────────
    existing_result = await db.execute(
        select(SdkError).where(SdkError.fingerprint == fingerprint)
    )
    existing_errors = existing_result.scalars().all()
    occurrence_count = len(existing_errors) + 1  # +1 for this new one

    # ── Persist this error event ──────────────────────────────────────────────
    sdk_error = SdkError(
        id=str(uuid.uuid4()),
        site_id=site.id,
        error_type=error_type,
        error_message=error_message,
        culprit=culprit,
        stack_file=stack_file[:500] if stack_file else None,
        stack_lineno=stack_lineno,
        stack_function=stack_function[:300] if stack_function else None,
        stack_frames=safe_frames,
        endpoint=endpoint,
        method=(payload.method or "").upper()[:10],
        status_code=payload.status_code,
        framework=payload.framework[:50] if payload.framework else site.framework,
        environment=payload.environment[:100],
        sdk_version=payload.sdk_version[:20],
        fingerprint=fingerprint,
        processed=False,
    )
    db.add(sdk_error)
    await db.flush()

    logger.info(
        f"[SDK] Error received: {error_type} @ {stack_file}:{stack_lineno} "
        f"— site={site.name} occurrence={occurrence_count}"
    )

    # ── Trigger pipeline once threshold is reached ────────────────────────────
    if occurrence_count >= _MIN_OCCURRENCES:
        # Check if there's already an active/recent incident for this fingerprint
        already_processing = any(
            e.processed for e in existing_errors
        )
        if not already_processing:
            logger.info(
                f"[SDK] Threshold reached ({occurrence_count} occurrences) "
                f"— triggering incident pipeline for {error_type}"
            )
            # Mark all existing errors for this fingerprint as processed
            for e in existing_errors:
                e.processed = True
            sdk_error.processed = True
            await db.flush()

            background_tasks.add_task(
                _run_sdk_incident_pipeline,
                sdk_error_id=sdk_error.id,
                site_id=site.id,
                occurrence_count=occurrence_count,
            )

    return {
        "status": "received",
        "error_id": sdk_error.id,
        "occurrence": occurrence_count,
        "pipeline_triggered": occurrence_count >= _MIN_OCCURRENCES,
    }


async def _run_sdk_incident_pipeline(
    sdk_error_id: str,
    site_id: str,
    occurrence_count: int,
):
    """Run the incident pipeline for an SDK-sourced error."""
    from backend.core.sdk_incident_pipeline import SdkIncidentPipeline

    async with AsyncSessionLocal() as db:
        try:
            pipeline = SdkIncidentPipeline(db)
            await pipeline.run(sdk_error_id=sdk_error_id, occurrence_count=occurrence_count)
            await db.commit()
        except Exception as e:
            logger.error(f"[SDK] Incident pipeline failed for error {sdk_error_id}: {e}")
            await db.rollback()


# ── SDK health ping ───────────────────────────────────────────────────────────

@router.post("/ping")
async def sdk_ping(
    db: AsyncSession = Depends(get_db),
    x_patchflow_key: str | None = Header(None, alias="X-PatchFlow-Key"),
    authorization: str | None = Header(None),
):
    """Lightweight heartbeat — confirms the SDK is installed and the key is valid."""
    raw_key = x_patchflow_key
    if not raw_key and authorization and authorization.startswith("Bearer "):
        raw_key = authorization.removeprefix("Bearer ").strip()

    if not raw_key:
        raise HTTPException(status_code=401, detail="Missing API key.")

    key_record, site = await _validate_api_key(raw_key, db)
    if not key_record or not site:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key.")

    site.sdk_status = "active"
    site.sdk_last_seen = datetime.utcnow()
    key_record.last_used_at = datetime.utcnow()
    await db.flush()

    return {"status": "ok", "site": site.name}
