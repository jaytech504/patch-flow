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

    # ── Subscription & Billing (Lemon Squeezy) ──────────────────────────────────
    subscription_tier = Column(String(50), default="free")  # free, pro, team
    subscription_status = Column(String(50), default="none")  # none, active, past_due, cancelled, paused, unpaid
    lemon_customer_id = Column(String(100), nullable=True)
    lemon_subscription_id = Column(String(100), nullable=True, index=True)
    lemon_variant_id = Column(String(100), nullable=True)
    subscription_renews_at = Column(DateTime, nullable=True)
    subscription_ends_at = Column(DateTime, nullable=True)
    email_alerts_enabled = Column(Boolean, default=True)

    # Usage tracking (resets monthly)
    monthly_incident_fixes_used = Column(Integer, default=0)
    monthly_chaos_scans_used = Column(Integer, default=0)
    usage_reset_at = Column(DateTime, default=datetime.utcnow)

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
    A site the user wants PatchFlow to monitor via the Agent SDK.
    Links a GitHub repo so real production errors can be auto-patched.
    """
    __tablename__ = "monitored_sites"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    url = Column(String(500), nullable=True)
    github_repo = Column(String(300), nullable=True)
    framework = Column(String(50), nullable=True)
    active = Column(Boolean, default=True)
    # SDK integration status
    sdk_status = Column(String(50), default="not_installed")  # not_installed | active | error
    sdk_last_seen = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="monitored_sites")
    incidents = relationship("Incident", back_populates="site", cascade="all, delete-orphan")
    api_keys = relationship("SiteApiKey", back_populates="site", cascade="all, delete-orphan")


class SiteApiKey(Base):
    """
    API key issued to a monitored site's SDK installation.
    Format: pf_live_<32-char-hex>
    One site can have multiple keys (rotation support); only active ones are accepted.
    """
    __tablename__ = "site_api_keys"

    id = Column(String, primary_key=True)
    site_id = Column(String, ForeignKey("monitored_sites.id"), nullable=False)
    key_hash = Column(String(64), nullable=False, unique=True)  # SHA-256 of the raw key
    key_prefix = Column(String(20), nullable=False)             # first 12 chars for display
    label = Column(String(100), nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)

    site = relationship("MonitoredSite", back_populates="api_keys")


# ── Incidents ─────────────────────────────────────────────────────────────────

class Incident(Base):
    """
    One incident run triggered by the PatchFlow Agent SDK.
    One error fingerprint + site = one potential draft PR.
    The dedup_key prevents duplicate pipeline runs for the same error.
    """
    __tablename__ = "sentry_incidents"   # table name kept for DB compat

    id = Column(String, primary_key=True)
    site_id = Column(String, ForeignKey("monitored_sites.id"), nullable=True)

    # Error identity (synthetic ID for SDK errors: "sdk_<sdk_error_id>")
    sentry_issue_id = Column(String(200), nullable=False)
    sentry_project = Column(String(200), nullable=True)   # site name
    dedup_key = Column(String(400), nullable=False, unique=True)

    # Error context (redacted before storage)
    error_title = Column(String(500), nullable=True)
    error_type = Column(String(200), nullable=True)
    culprit = Column(String(500), nullable=True)
    stack_file = Column(String(500), nullable=True)
    stack_lineno = Column(Integer, nullable=True)
    stack_function = Column(String(300), nullable=True)
    environment = Column(String(100), nullable=True)
    event_count = Column(Integer, default=0)
    user_count = Column(Integer, default=0)

    # Pipeline outcome
    status = Column(Enum(IncidentStatus), default=IncidentStatus.RECEIVED)
    skip_reason = Column(Text, nullable=True)
    pr_url = Column(String(500), nullable=True)
    pr_number = Column(Integer, nullable=True)
    github_repo = Column(String(300), nullable=True)
    fix_summary = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

    site = relationship("MonitoredSite", back_populates="incidents")


# ── SDK error events ──────────────────────────────────────────────────────────

class SdkError(Base):
    """
    A raw error event received from the PatchFlow Agent SDK.
    Stored before dedup/pipeline processing.
    """
    __tablename__ = "sdk_errors"

    id = Column(String, primary_key=True)
    site_id = Column(String, ForeignKey("monitored_sites.id"), nullable=False)

    # Error identity
    error_type = Column(String(300), nullable=True)      # e.g. "ValueError"
    error_message = Column(Text, nullable=True)           # redacted message
    culprit = Column(String(500), nullable=True)          # endpoint or function

    # Stack context
    stack_file = Column(String(500), nullable=True)
    stack_lineno = Column(Integer, nullable=True)
    stack_function = Column(String(300), nullable=True)
    stack_frames = Column(JSON, default=list)             # redacted frames

    # Request context
    endpoint = Column(String(500), nullable=True)         # /api/users
    method = Column(String(10), nullable=True)            # GET/POST etc.
    status_code = Column(Integer, nullable=True)

    # Metadata
    framework = Column(String(50), nullable=True)         # fastapi/express/etc.
    environment = Column(String(100), nullable=True)
    sdk_version = Column(String(20), nullable=True)

    # Dedup fingerprint — hash of (site_id + error_type + stack_file + stack_lineno)
    fingerprint = Column(String(64), nullable=False, index=True)

    # Pipeline outcome
    incident_id = Column(String, ForeignKey("sentry_incidents.id"), nullable=True)
    processed = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    site = relationship("MonitoredSite")


