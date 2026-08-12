"""
Sentry webhook receiver — Phase 4.

Handles POST /api/sentry/webhook
  1. HMAC-SHA256 signature validation
  2. Event-type filtering (issue.created, issue.unresolved, error.created)
  3. Hands off to the incident pipeline as a FastAPI background task
"""

from __future__ import annotations

import hashlib
import hmac
import json

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.db.session import AsyncSessionLocal

router = APIRouter()
settings = get_settings()

# Webhook event types we act on
_HANDLED_EVENTS = {"issue.created", "issue.unresolved", "error.created"}


def _verify_signature(body: bytes, sentry_hook_signature: str | None) -> bool:
    """
    Sentry signs each webhook with HMAC-SHA256 using the client secret.
    Header name: sentry-hook-signature
    """
    if not settings.sentry_webhook_secret:
        # Secret not configured — allow through in dev, warn loudly
        logger.warning("[Sentry] SENTRY_WEBHOOK_SECRET not set — skipping signature check.")
        return True

    if not sentry_hook_signature:
        logger.warning("[Sentry] Missing sentry-hook-signature header.")
        return False

    expected = hmac.new(
        settings.sentry_webhook_secret.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, sentry_hook_signature)


@router.post("/webhook")
async def sentry_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    sentry_hook_resource: str | None = Header(None, alias="sentry-hook-resource"),
    sentry_hook_signature: str | None = Header(None, alias="sentry-hook-signature"),
):
    body = await request.body()

    # ── 1. Signature validation ───────────────────────────────────────────────
    if not _verify_signature(body, sentry_hook_signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")

    # ── 2. Parse payload ──────────────────────────────────────────────────────
    try:
        payload = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    action = payload.get("action", "")
    resource = sentry_hook_resource or payload.get("resource", "")
    event_type = f"{resource}.{action}" if resource and action else resource

    logger.info(f"[Sentry] Webhook received: {event_type}")

    # ── 3. Filter to handled event types ─────────────────────────────────────
    if event_type not in _HANDLED_EVENTS:
        logger.info(f"[Sentry] Ignoring event type: {event_type}")
        return {"status": "ignored", "event_type": event_type}

    # ── 4. Extract issue data from payload ────────────────────────────────────
    issue_data = payload.get("data", {}).get("issue") or payload.get("issue") or {}
    issue_id = str(issue_data.get("id", ""))
    if not issue_id:
        logger.warning("[Sentry] Webhook payload missing issue ID.")
        return {"status": "skipped", "reason": "no_issue_id"}

    # ── 5. Hand off to pipeline as background task ────────────────────────────
    background_tasks.add_task(_run_incident_pipeline, issue_id, issue_data, event_type)

    return {"status": "accepted", "issue_id": issue_id}


async def _run_incident_pipeline(issue_id: str, issue_data: dict, event_type: str):
    """Run the incident pipeline in a background task with its own DB session."""
    from backend.core.incident_pipeline import IncidentPipeline

    async with AsyncSessionLocal() as db:
        try:
            pipeline = IncidentPipeline(db)
            await pipeline.run(issue_id=issue_id, issue_data=issue_data, event_type=event_type)
            await db.commit()
        except Exception as e:
            logger.error(f"[Sentry] Incident pipeline failed for issue {issue_id}: {e}")
            await db.rollback()
