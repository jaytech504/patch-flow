from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.session import get_db
from backend.db.models import Report, FailureResult, Endpoint

router = APIRouter()


def _serialise_fix(fix: dict) -> dict:
    """
    Normalise a fix dict for the frontend, ensuring every Phase 1+2 field
    is present so the UI doesn't need defensive .get() chains.
    """
    return {
        # Core identity
        "finding_title": fix.get("finding_title", ""),
        "failure_modes": fix.get("failure_modes", []),
        "affected_endpoints": fix.get("affected_endpoints", []),
        "severity": fix.get("severity", ""),
        "language": fix.get("language", ""),
        "fix_type": fix.get("fix_type", ""),
        "file_path": fix.get("file_path", ""),
        "start_line": fix.get("start_line"),
        "end_line": fix.get("end_line"),
        # Code
        "code_before": fix.get("code_before", ""),
        "code_after": fix.get("code_after", ""),
        "imports_needed": fix.get("imports_needed", []),
        # Unified diff (empty string when not generated)
        "unified_diff": fix.get("unified_diff", ""),
        # Narrative
        "explanation": fix.get("explanation", ""),
        # Lifecycle status
        "status": fix.get("status", "generated"),
        # fix_mode: 'patch' = applied to real repo file, 'recommendation' = no repo
        "fix_mode": fix.get("fix_mode", "patch"),
        # Validation report from PatchValidator
        "validation": fix.get("validation") or {},
        # Review outcome
        "review_status": fix.get("review_status"),
        "review_issues": fix.get("review_issues", []),
        # PR skip reason (set by GitHubAgent)
        "skip_reason": fix.get("skip_reason"),
    }


def _serialise_skipped_fix(fix: dict) -> dict:
    """Serialise a blocked fix for the 'Why no PR?' panel."""
    return {
        "finding_title": fix.get("finding_title", ""),
        "affected_endpoints": fix.get("affected_endpoints", []),
        "file_path": fix.get("file_path", ""),
        "status": fix.get("status", "pr_skipped"),
        "skip_reason": fix.get("skip_reason") or fix.get("review_feedback", ""),
        "review_issues": fix.get("review_issues", []),
        "validation": fix.get("validation") or {},
    }


@router.get("/{report_id}")
async def get_report(report_id: str, db: AsyncSession = Depends(get_db)):
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Load all endpoints for the session to map endpoint_id → path
    endpoints_result = await db.execute(
        select(Endpoint).where(Endpoint.session_id == report.session_id)
    )
    endpoints_map = {ep.id: ep for ep in endpoints_result.scalars().all()}

    # Get all failure results that had fixes generated
    failures_result = await db.execute(
        select(FailureResult)
        .where(FailureResult.session_id == report.session_id)
        .where(FailureResult.fix_generated == True)  # noqa: E712
    )
    fixed_failures = failures_result.scalars().all()

    # Build a lookup of (failure_mode, endpoint_id) → code_before
    # so the fixed_failures response can include before-code for legacy consumers.
    before_code_map: dict[tuple, str] = {}
    for fix in (report.fixes or []):
        modes = fix.get("failure_modes", [])
        ep_paths = fix.get("affected_endpoints", [])
        code_before = fix.get("code_before", "")
        for mode in modes:
            for ep_path in ep_paths:
                for ep_id, ep_obj in endpoints_map.items():
                    if ep_obj.path == ep_path:
                        before_code_map[(mode, ep_id)] = code_before

    return {
        "id": report.id,
        "session_id": report.session_id,
        "risk_score": report.risk_score,
        "summary": report.summary,
        "critical_findings": report.critical_findings or [],
        "all_findings": report.all_findings or [],
        # Normalised fix list — includes unified_diff, status, validation
        "fixes": [_serialise_fix(f) for f in (report.fixes or [])],
        # Fixes that were blocked before reaching a PR (Phase 1 "Why no PR?" panel)
        "skipped_fixes": [
            _serialise_skipped_fix(f) for f in (report.skipped_fixes or [])
        ],
        # Legacy field — kept for backward compat with existing frontend consumers
        "fixed_failures": [
            {
                "failure_mode": f.failure_mode,
                "endpoint": (
                    endpoints_map[f.endpoint_id].path
                    if f.endpoint_id in endpoints_map
                    else f.endpoint_id
                ),
                "fix_code": f.fix_code,
                "fix_explanation": f.fix_explanation,
                "before_code": before_code_map.get((f.failure_mode, f.endpoint_id), ""),
            }
            for f in fixed_failures
        ],
        "created_at": report.created_at.isoformat(),
    }


@router.get("/session/{session_id}")
async def get_report_by_session(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Report).where(Report.session_id == session_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found for this session")
    return {"report_id": report.id}
