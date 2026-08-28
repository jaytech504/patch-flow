import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete
from typing import Optional
import json
from loguru import logger

from backend.db.session import get_db, AsyncSessionLocal
from backend.db.models import ChaosSession, SessionStatus, FailureResult, Endpoint, PullRequest, User, AgentStep, Incident
from backend.agents.orchestrator import ChaosOrchestrator
from backend.agents.discovery_agent import DiscoveryAgent
from backend.auth.dependencies import get_current_user
from backend.core.websocket_manager import ws_manager
from backend.core.security_guards import validate_target_url, scan_start_limiter, rate_limit
from backend.core.draft_cache import draft_cache
from backend.core.billing_guards import can_run_chaos_scan, increment_scan_usage

router = APIRouter()

# ── Input models ──────────────────────────────────────────────────────────────

class StartSessionRequest(BaseModel):
    draft_id: str
    target_url: str
    target_name: str = "My API"
    github_repo: Optional[str] = None
    selected_temp_ids: list[str]


class StartSessionLegacyRequest(BaseModel):
    target_url: str
    target_name: str = "My API"
    github_repo: Optional[str] = None


# ── Legacy/Direct Start Session ────────────────────────────────────────────────

@router.post("", dependencies=[Depends(rate_limit(scan_start_limiter))])
async def start_session_legacy(
    body: StartSessionLegacyRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Start a chaos session directly by discovering and running endpoints from openapi_url.
    """
    # SSRF guard on target_url
    body.target_url = validate_target_url(body.target_url)

    allowed, err_msg = can_run_chaos_scan(user)
    if not allowed:
        raise HTTPException(status_code=403, detail=err_msg)

    session_id = str(uuid.uuid4())
    github_token = _resolve_github_token(user, body.github_repo)

    session = ChaosSession(
        id=session_id,
        target_url=body.target_url,
        target_name=body.target_name,
        github_repo=body.github_repo,
        user_id=user.id,
        status=SessionStatus.PENDING,
    )
    db.add(session)
    await db.commit()

    await increment_scan_usage(db, user)

    discovery = DiscoveryAgent(db, session_id)
    try:
        spec_url = f"{body.target_url.rstrip('/')}/openapi.json"
        endpoints = await discovery.from_openapi_url(spec_url)
    except Exception as e:
        logger.warning(f"Could not discover from openapi.json: {e}")
        endpoints = []

    if not endpoints:
        raise HTTPException(
            status_code=400,
            detail="No endpoints found. Make sure your app is running and exposes an OpenAPI spec at /openapi.json",
        )

    background_tasks.add_task(
        _run_pipeline_with_endpoints,
        session_id, body.target_url, endpoints, body.github_repo, github_token
    )

    return {
        "session_id": session_id,
        "method": "openapi_url",
        "endpoints_found": len(endpoints),
    }


# ── Start Session from Spec Draft ──────────────────────────────────────────────

@router.post("/start", dependencies=[Depends(rate_limit(scan_start_limiter))])
async def start_session(
    body: StartSessionRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Start a chaos session using endpoints selected from a parsed draft.
    """
    if not body.selected_temp_ids:
        raise HTTPException(status_code=400, detail="No endpoints selected.")
    if len(body.selected_temp_ids) > 10:
        raise HTTPException(status_code=400, detail="A maximum of 10 endpoints can be selected per chaos session.")

    # SSRF guard on target_url
    body.target_url = validate_target_url(body.target_url)

    # Retrieve from short-lived TTL cache
    draft = draft_cache.get(body.draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft spec not found or expired.")

    all_draft_endpoints = draft.get("endpoints", [])
    filtered_endpoints = [
        ep for ep in all_draft_endpoints
        if ep.get("temp_id") in body.selected_temp_ids
    ]

    if not filtered_endpoints:
        raise HTTPException(
            status_code=400,
            detail="None of the selected endpoints exist in the draft spec."
        )

    # ── Check chaos scan quota ───────────────────────────────────────────────
    allowed, err_msg = can_run_chaos_scan(user)
    if not allowed:
        raise HTTPException(status_code=403, detail=err_msg)

    session_id = str(uuid.uuid4())
    github_token = _resolve_github_token(user, body.github_repo)

    session = ChaosSession(
        id=session_id,
        target_url=body.target_url,
        target_name=body.target_name,
        github_repo=body.github_repo,
        user_id=user.id,
        status=SessionStatus.PENDING,
    )
    db.add(session)
    await db.commit()

    # Increment user's monthly chaos scan usage
    await increment_scan_usage(db, user)

    # Persist only the chosen endpoints
    discovery = DiscoveryAgent(db, session_id)
    saved_endpoints = await discovery.save_selected_endpoints(filtered_endpoints)

    # Invalidate cache entry
    draft_cache.delete(body.draft_id)

    background_tasks.add_task(
        _run_pipeline_with_endpoints,
        session_id, body.target_url, saved_endpoints, body.github_repo, github_token
    )

    return {
        "session_id": session_id,
        "method": draft.get("method", "openapi_url"),
        "endpoints_found": len(saved_endpoints),
        "github_repo": body.github_repo,
    }



# ── Session list + detail ──────────────────────────────────────────────────────

@router.get("")
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Only list user-initiated Chaos Testing sessions for the authenticated user
    incident_subquery = select(Incident.id)
    query = (
        select(ChaosSession)
        .where(ChaosSession.user_id == user.id)
        .where(ChaosSession.id.not_in(incident_subquery))
        .order_by(desc(ChaosSession.created_at))
        .limit(50)
    )
    result = await db.execute(query)
    sessions = result.scalars().all()
    return [
        {
            "id": s.id,
            "target_name": s.target_name,
            "target_url": s.target_url,
            "github_repo": s.github_repo,
            "status": s.status.value,
            "endpoints_found": s.endpoints_found,
            "failures_injected": s.failures_injected,
            "unhandled_count": s.unhandled_count,
            "fixes_generated": s.fixes_generated,
            "created_at": s.created_at.isoformat(),
        }
        for s in sessions
    ]


@router.get("/{session_id}")
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = await db.get(ChaosSession, session_id)
    if not session or (session.user_id and session.user_id != user.id):
        raise HTTPException(status_code=404, detail="Session not found")

    endpoints_result = await db.execute(
        select(Endpoint).where(Endpoint.session_id == session_id)
    )
    failures_result = await db.execute(
        select(FailureResult).where(FailureResult.session_id == session_id)
    )
    prs_result = await db.execute(
        select(PullRequest).where(PullRequest.session_id == session_id)
    )
    steps_result = await db.execute(
        select(AgentStep).where(AgentStep.session_id == session_id).order_by(AgentStep.created_at.asc())
    )

    endpoints = endpoints_result.scalars().all()
    failures = failures_result.scalars().all()
    prs = prs_result.scalars().all()
    steps = steps_result.scalars().all()

    return {
        "id": session.id,
        "target_name": session.target_name,
        "target_url": session.target_url,
        "github_repo": session.github_repo,
        "status": session.status.value if hasattr(session.status, "value") else (session.status or "pending"),
        "endpoints_found": session.endpoints_found,
        "failures_injected": session.failures_injected,
        "unhandled_count": session.unhandled_count,
        "fixes_generated": session.fixes_generated,
        "created_at": session.created_at.isoformat() if session.created_at else "",
        "completed_at": session.completed_at.isoformat() if session.completed_at else None,
        "endpoints": [
            {
                "id": e.id, "path": e.path, "method": e.method,
                "description": e.description, "dependencies": e.dependencies,
            }
            for e in endpoints
        ],
        "failures": [
            {
                "id": f.id, "endpoint_id": f.endpoint_id,
                "failure_mode": f.failure_mode, "result": f.result.value,
                "status_code": f.status_code_received,
                "error_leaked": f.error_leaked, "fix_generated": f.fix_generated,
            }
            for f in failures
        ],
        "pull_requests": [
            {
                "id": pr.id,
                "pr_number": pr.pr_number,
                "pr_url": pr.pr_url,
                "pr_title": pr.pr_title,
                "finding_title": pr.finding_title,
                "files_changed": pr.files_changed,
                "status": pr.status,
                "branch_name": pr.branch_name,
            }
            for pr in prs
        ],
        "agent_steps": [
            {
                "agent": step.agent,
                "step_type": step.step_type,
                "content": step.content,
                "created_at": step.created_at.isoformat(),
            }
            for step in steps
        ],
    }


# ── Helpers ────────────────────────────────────────────────────────────────────

def _resolve_github_token(user: Optional[User], github_repo: Optional[str]) -> Optional[str]:
    """
    Determine which GitHub token to use for PR creation.
    Priority: user's OAuth token > global fallback from .env
    """
    if not github_repo:
        return None

    if user and user.github_access_token:
        return user.github_access_token

    # Fallback to global token (for dev/demo use)
    from backend.core.config import get_settings
    settings = get_settings()
    return settings.github_token or None


# ── Background pipeline ────────────────────────────────────────────────────────

async def _run_pipeline_with_endpoints(
    session_id: str,
    target_url: str,
    endpoints: list[dict],
    github_repo: str = None,
    github_token: str = None,
):
    """
    Run chaos pipeline starting from pre-discovered endpoints.
    Discovery has already happened — skip straight to chaos injection.
    """
    async with AsyncSessionLocal() as db:
        try:
            orchestrator = ChaosOrchestrator(db, session_id)
            await orchestrator.run_from_endpoints(
                target_url, endpoints, github_repo, github_token
            )
            await db.commit()
        except Exception as e:
            logger.exception(f"[Background Pipeline] Failed to run pipeline for session {session_id}")
            await db.rollback()
            try:
                # Update session status to failed using a clean session to avoid transaction errors
                async with AsyncSessionLocal() as fail_db:
                    session = await fail_db.get(ChaosSession, session_id)
                    if session:
                        session.status = SessionStatus.FAILED
                        await fail_db.commit()
                # Notify frontend of failure via WebSocket
                await ws_manager.emit_status(session_id, "failed", f"Pipeline failed: {str(e)}")
            except Exception as db_err:
                logger.error(f"[Background Pipeline] Failed to update session status to FAILED: {db_err}")


# ── Retry failed session ──────────────────────────────────────────────────────

@router.post("/{session_id}/retry")
async def retry_session(
    session_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Rerun a failed chaos session using its pre-discovered endpoints.
    """
    session = await db.get(ChaosSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    # Update status to pending
    session.status = SessionStatus.PENDING
    session.fixes_generated = 0
    session.prs_opened = 0
    session.risk_score = 0
    session.unhandled_count = 0
    session.completed_at = None

    # Clear previous run results
    from backend.db.models import FailureResult, AgentStep, Report, PullRequest
    await db.execute(delete(PullRequest).where(PullRequest.session_id == session_id))
    await db.execute(delete(Report).where(Report.session_id == session_id))
    await db.execute(delete(AgentStep).where(AgentStep.session_id == session_id))
    await db.execute(delete(FailureResult).where(FailureResult.session_id == session_id))

    await db.flush()

    # Load endpoints
    endpoints_result = await db.execute(
        select(Endpoint).where(Endpoint.session_id == session_id)
    )
    endpoints = endpoints_result.scalars().all()
    if not endpoints:
        raise HTTPException(status_code=400, detail="No endpoints found to retry.")

    # Convert endpoints to list of dicts for run_from_endpoints
    endpoints_payload = [
        {
            "id": ep.id,
            "path": ep.path,
            "method": ep.method,
            "description": ep.description,
            "sample_payload": ep.sample_payload,
            "dependencies": ep.dependencies,
        }
        for ep in endpoints
    ]

    github_token = _resolve_github_token(user, session.github_repo)

    # Trigger background pipeline rerun
    background_tasks.add_task(
        _run_pipeline_with_endpoints,
        session_id, session.target_url, endpoints_payload, session.github_repo, github_token
    )

    await db.commit()

    return {"status": "retrying", "session_id": session_id}
