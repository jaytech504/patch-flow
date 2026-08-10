"""
Typed Pydantic models for the PatchFlow agent pipeline.

These models define the contract between agents and replace the raw dict
passing that previously made silent field drops and schema drift possible.

Hierarchy:
  AnalysisResult       — output of AnalystAgent
    └─ Finding         — one identified vulnerability

  FixCandidate         — a single proposed fix, before review
  ValidatedFix         — fix that has passed ReviewAgent
  SkippedFix           — fix that was blocked (validation_failed / pr_skipped)

  ReviewVerdict        — output of ReviewAgent for one fix

  FixStatus            — lifecycle enum carried on every fix dict
  SessionReport        — final assembled report sent to DB / frontend
"""

from __future__ import annotations

import difflib
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ── Enums ─────────────────────────────────────────────────────────────────────

class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class FixStatus(str, Enum):
    """Lifecycle of a single fix from generation to PR."""
    GENERATED = "generated"           # just produced by FixAgent
    VALIDATED = "validated"           # passed ReviewAgent
    NEEDS_REVIEW = "needs_review"     # reviewer requested changes
    VALIDATION_FAILED = "validation_failed"  # PatchValidator or syntax gate failed
    PR_SKIPPED = "pr_skipped"         # blocked from PR due to failed validation
    DRAFT_PR_OPENED = "draft_pr_opened"


# ── Analysis ──────────────────────────────────────────────────────────────────

class Finding(BaseModel):
    title: str
    severity: Severity
    affected_endpoints: list[str] = Field(default_factory=list)
    failure_modes: list[str] = Field(default_factory=list)
    evidence: str = ""
    description: str = ""            # alias for evidence in some LLM outputs

    @model_validator(mode="after")
    def _fill_description(self) -> "Finding":
        # Some LLM outputs use "description", others "evidence" — normalise both
        if not self.evidence and self.description:
            self.evidence = self.description
        if not self.description and self.evidence:
            self.description = self.evidence
        return self

    @field_validator("severity", mode="before")
    @classmethod
    def _coerce_severity(cls, v: Any) -> str:
        if isinstance(v, str):
            return v.upper()
        return v


class AnalysisResult(BaseModel):
    risk_score: int = Field(ge=0, le=100)
    summary: str = ""
    critical_findings: list[Finding] = Field(default_factory=list)
    all_findings: list[Finding] = Field(default_factory=list)
    patterns: list[str] = Field(default_factory=list)

    @field_validator("risk_score", mode="before")
    @classmethod
    def _clamp(cls, v: Any) -> int:
        try:
            return max(0, min(100, int(v)))
        except (TypeError, ValueError):
            return 0

    def to_dict(self) -> dict:
        """Serialise to a plain dict compatible with the existing DB/report shape."""
        return {
            "risk_score": self.risk_score,
            "summary": self.summary,
            "critical_findings": [f.model_dump() for f in self.critical_findings],
            "all_findings": [f.model_dump() for f in self.all_findings],
            "patterns": self.patterns,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AnalysisResult":
        """Construct from a raw dict (tolerant of missing / extra fields)."""
        findings_raw = data.get("all_findings", [])
        critical_raw = data.get("critical_findings", [])
        return cls(
            risk_score=data.get("risk_score", 0),
            summary=data.get("summary", ""),
            critical_findings=[
                Finding.model_validate(f) for f in critical_raw
                if isinstance(f, dict)
            ],
            all_findings=[
                Finding.model_validate(f) for f in findings_raw
                if isinstance(f, dict)
            ],
            patterns=data.get("patterns", []),
        )


# ── Fix candidate ─────────────────────────────────────────────────────────────

class SourceSnapshot(BaseModel):
    """Immutable record of the original source at fix-generation time."""
    file_path: str
    start_line: int
    end_line: int
    content: str                   # exact characters read from the cloned repo


class FixCandidate(BaseModel):
    """A fix produced by FixAgent, before it goes through ReviewAgent."""

    # Identity / linking
    finding_title: str = ""
    failure_modes: list[str] = Field(default_factory=list)
    affected_endpoints: list[str] = Field(default_factory=list)
    severity: Severity = Severity.HIGH

    # Code
    file_path: str = ""
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    code_before: str = ""          # original handler code
    code_after: str = ""           # proposed replacement
    imports_needed: list[str] = Field(default_factory=list)
    language: str = "python"
    fix_type: str = "exception_handler"

    # Narrative
    explanation: str = ""

    # Immutable snapshot captured at generation time
    source_snapshot: Optional[SourceSnapshot] = None

    # Computed unified diff (set by FixAgent after applying the fix)
    unified_diff: str = ""

    # Validation result from PatchValidator
    validation: Optional[dict] = None

    # Lifecycle status
    status: FixStatus = FixStatus.GENERATED

    # Review feedback (set by ReviewAgent when revision is needed)
    review_status: Optional[str] = None
    review_feedback: Optional[str] = None
    review_issues: list[str] = Field(default_factory=list)
    revision_attempt: int = 0

    # PR skip reason (set by GitHubAgent when a fix is blocked)
    skip_reason: Optional[str] = None

    @field_validator("severity", mode="before")
    @classmethod
    def _coerce_severity(cls, v: Any) -> str:
        if isinstance(v, str):
            return v.upper()
        return v

    @field_validator("code_before", "code_after", mode="before")
    @classmethod
    def _ensure_str(cls, v: Any) -> str:
        return v if isinstance(v, str) else ""

    @field_validator("imports_needed", mode="before")
    @classmethod
    def _ensure_list(cls, v: Any) -> list:
        return v if isinstance(v, list) else []

    def compute_unified_diff(self) -> str:
        """Generate a unified diff between code_before and code_after."""
        if not self.code_before and not self.code_after:
            return ""
        before_lines = self.code_before.splitlines(keepends=True)
        after_lines = self.code_after.splitlines(keepends=True)
        label = self.file_path or "unknown"
        diff = list(difflib.unified_diff(
            before_lines,
            after_lines,
            fromfile=f"a/{label}",
            tofile=f"b/{label}",
            lineterm="",
        ))
        return "\n".join(diff)

    def to_dict(self) -> dict:
        """Serialise to a plain dict, compatible with the existing DB/report shape."""
        d = self.model_dump(exclude={"source_snapshot"})
        # Ensure enum values are serialised as plain strings
        d["severity"] = self.severity.value
        d["status"] = self.status.value
        return d

    @classmethod
    def from_dict(cls, data: dict) -> "FixCandidate":
        """Construct from a raw dict produced by existing agent code."""
        # Normalise code_before/code_after aliases used in legacy code
        if not data.get("code_before") and data.get("original_code"):
            data = {**data, "code_before": data["original_code"]}
        if not data.get("code_after") and data.get("fixed_code"):
            data = {**data, "code_after": data["fixed_code"]}
        return cls.model_validate(data)


# ── Review ────────────────────────────────────────────────────────────────────

class ReviewVerdict(BaseModel):
    verdict: Literal["validated", "revision_needed"]
    issues: list[str] = Field(default_factory=list)
    revision_instructions: str = ""

    @field_validator("verdict", mode="before")
    @classmethod
    def _normalise(cls, v: Any) -> str:
        if isinstance(v, str):
            v = v.lower().strip()
        if v not in {"validated", "revision_needed"}:
            return "revision_needed"
        return v

    @classmethod
    def fail_closed(cls, reason: str) -> "ReviewVerdict":
        """Return a revision_needed verdict when review cannot proceed safely."""
        return cls(
            verdict="revision_needed",
            issues=[reason],
            revision_instructions=reason,
        )


# ── Skipped fix ───────────────────────────────────────────────────────────────

class SkippedFix(BaseModel):
    """A fix that was blocked from becoming a PR."""
    finding_title: str = ""
    affected_endpoints: list[str] = Field(default_factory=list)
    file_path: str = ""
    status: Literal[
        FixStatus.VALIDATION_FAILED,
        FixStatus.PR_SKIPPED,
        FixStatus.NEEDS_REVIEW,
    ] = FixStatus.PR_SKIPPED
    reason: str = ""
    validation_checks: list[dict] = Field(default_factory=list)


# ── Session report ────────────────────────────────────────────────────────────

class SessionReport(BaseModel):
    """
    The assembled final report for a chaos session.
    Stored in the reports table as JSON blobs.
    """
    report_id: str = ""
    session_id: str = ""
    risk_score: int = 0
    summary: str = ""
    critical_findings: list[Finding] = Field(default_factory=list)
    all_findings: list[Finding] = Field(default_factory=list)
    patterns: list[str] = Field(default_factory=list)

    # All fixes, regardless of status
    fixes: list[FixCandidate] = Field(default_factory=list)
    skipped_fixes: list[SkippedFix] = Field(default_factory=list)

    def fixes_as_dicts(self) -> list[dict]:
        return [f.to_dict() for f in self.fixes]

    def skipped_fixes_as_dicts(self) -> list[dict]:
        return [s.model_dump() for s in self.skipped_fixes]
