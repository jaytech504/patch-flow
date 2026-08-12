from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, JSON, Enum, ForeignKey
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.ext.asyncio import AsyncAttrs


class Base(AsyncAttrs, DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    github_id = Column(Integer, unique=True, nullable=False)
    github_username = Column(String(100), nullable=False)
    github_avatar_url = Column(String(500), nullable=True)
    github_access_token = Column(String(500), nullable=False)
    email = Column(String(300), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, default=datetime.utcnow)

    sessions = relationship("ChaosSession", back_populates="user")
    monitored_sites = relationship("MonitoredSite", back_populates="user")


class SessionStatus(str, PyEnum):
    PENDING = "pending"
    DISCOVERING = "discovering"
    INJECTING = "injecting"
    ANALYSING = "analysing"
    FIXING = "fixing"
    OPENING_PRS = "opening_prs"
    COMPLETE = "complete"
    FAILED = "failed"


class FailureStatus(str, PyEnum):
    UNHANDLED = "unhandled"
    HANDLED = "handled"
    DEGRADED = "degraded"


class IncidentStatus(str, PyEnum):
    RECEIVED   = "received"      # webhook received, not yet processed
    PROCESSING = "processing"    # pipeline running
    PR_OPENED  = "pr_opened"     # draft PR created
    SKIPPED    = "skipped"       # blocked by threshold / blocklist / dedup
    FAILED     = "failed"        # pipeline error


class ChaosSession(Base):
    __tablename__ = "chaos_sessions"

    id = Column(String, primary_key=True)
    target_url = Column(String(500), nullable=False)
    target_name = Column(String(100), nullable=True)
    source_path = Column(String(500), nullable=True)
    github_repo = Column(String(300), nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    status = Column(Enum(SessionStatus), default=SessionStatus.PENDING)
    endpoints_found = Column(Integer, default=0)
    failures_injected = Column(Integer, default=0)
    unhandled_count = Column(Integer, default=0)
    fixes_generated = Column(Integer, default=0)
    prs_opened = Column(Integer, default=0)
    risk_score = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    endpoints = relationship("Endpoint", back_populates="session", cascade="all, delete-orphan")
    failures = relationship("FailureResult", back_populates="session", cascade="all, delete-orphan")
    agent_steps = relationship("AgentStep", back_populates="session", cascade="all, delete-orphan")
    report = relationship("Report", back_populates="session", uselist=False, cascade="all, delete-orphan")
    pull_requests = relationship("PullRequest", back_populates="session", cascade="all, delete-orphan")
    user = relationship("User", back_populates="sessions")


class Endpoint(Base):
    __tablename__ = "endpoints"

    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("chaos_sessions.id"), nullable=False)
    path = Column(String(500), nullable=False)
    method = Column(String(10), nullable=False)
    description = Column(Text, nullable=True)
    sample_payload = Column(JSON, nullable=True)
    dependencies = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChaosSession", back_populates="endpoints")
    failures = relationship("FailureResult", back_populates="endpoint")


class FailureResult(Base):
    __tablename__ = "failure_results"

    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("chaos_sessions.id"), nullable=False)
    endpoint_id = Column(String, ForeignKey("endpoints.id"), nullable=False)
    failure_mode = Column(String(100), nullable=False)
    failure_description = Column(Text, nullable=True)
    status_code_received = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    result = Column(Enum(FailureStatus), default=FailureStatus.UNHANDLED)
    error_leaked = Column(Boolean, default=False)
    stack_trace_leaked = Column(Boolean, default=False)
    fix_generated = Column(Boolean, default=False)
    fix_code = Column(Text, nullable=True)
    fix_explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChaosSession", back_populates="failures")
    endpoint = relationship("Endpoint", back_populates="failures")


class AgentStep(Base):
    __tablename__ = "agent_steps"

    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("chaos_sessions.id"), nullable=False)
    agent = Column(String(50), nullable=False)
    step_type = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    tool_name = Column(String(100), nullable=True)
    tool_input = Column(JSON, nullable=True)
    tool_output = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChaosSession", back_populates="agent_steps")


class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("chaos_sessions.id"), nullable=False)
    summary = Column(Text, nullable=True)
    critical_findings = Column(JSON, default=list)
    all_findings = Column(JSON, default=list)
    fixes = Column(JSON, default=list)
    skipped_fixes = Column(JSON, default=list)
    risk_score = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChaosSession", back_populates="report")


class PullRequest(Base):
    __tablename__ = "pull_requests"

    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("chaos_sessions.id"), nullable=False)
    report_id = Column(String, ForeignKey("reports.id"), nullable=False)
    github_repo = Column(String(300), nullable=False)
    branch_name = Column(String(200), nullable=False)
    pr_number = Column(Integer, nullable=True)
    pr_url = Column(String(500), nullable=True)
    pr_title = Column(String(300), nullable=False)
    finding_title = Column(String(300), nullable=True)
    files_changed = Column(JSON, default=list)
    status = Column(String(50), default="opened")
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChaosSession", back_populates="pull_requests")


# ── Phase 4: Monitored Sites ──────────────────────────────────────────────────

class MonitoredSite(Base):
    """
    A site/project the user wants PatchFlow to watch via Sentry.
    Links a Sentry project to a GitHub repo so incidents can be auto-patched.
    """
    __tablename__ = "monitored_sites"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)           # display name
    url = Column(String(500), nullable=True)             # production URL
    github_repo = Column(String(300), nullable=True)     # owner/repo
    sentry_project_slug = Column(String(200), nullable=True)
    sentry_org = Column(String(200), nullable=True)
    framework = Column(String(50), nullable=True)        # detected or set by user
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="monitored_sites")
    incidents = relationship("SentryIncident", back_populates="site", cascade="all, delete-orphan")


# ── Phase 4: Sentry Incidents ─────────────────────────────────────────────────

class SentryIncident(Base):
    """
    One incident run: one Sentry issue + one release = one potential draft PR.
    The dedup_key (sentry_issue_id + release) prevents duplicate runs.
    """
    __tablename__ = "sentry_incidents"

    id = Column(String, primary_key=True)
    site_id = Column(String, ForeignKey("monitored_sites.id"), nullable=True)

    # Sentry identifiers
    sentry_issue_id = Column(String(200), nullable=False)
    sentry_issue_url = Column(String(500), nullable=True)
    sentry_project = Column(String(200), nullable=True)
    sentry_release = Column(String(200), nullable=True)
    dedup_key = Column(String(400), nullable=False, unique=True)  # issue_id + release

    # Error context (redacted before storage)
    error_title = Column(String(500), nullable=True)
    error_type = Column(String(200), nullable=True)
    culprit = Column(String(500), nullable=True)        # Sentry's culprit field
    stack_file = Column(String(500), nullable=True)     # file from top stack frame
    stack_lineno = Column(Integer, nullable=True)
    stack_function = Column(String(300), nullable=True)
    environment = Column(String(100), nullable=True)
    event_count = Column(Integer, default=0)
    user_count = Column(Integer, default=0)

    # Pipeline outcome
    status = Column(Enum(IncidentStatus), default=IncidentStatus.RECEIVED)
    skip_reason = Column(Text, nullable=True)           # why it was skipped
    pr_url = Column(String(500), nullable=True)
    pr_number = Column(Integer, nullable=True)
    github_repo = Column(String(300), nullable=True)
    fix_summary = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

    site = relationship("MonitoredSite", back_populates="incidents")


