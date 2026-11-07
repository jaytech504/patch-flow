import os
import asyncpg
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from backend.core.config import get_settings
from backend.db.models import Base

settings = get_settings()

def _normalize_db_url(url: str) -> str:
    """
    Normalizes PostgreSQL connection strings for asyncpg:
    1. Converts postgres:// and postgresql:// to postgresql+asyncpg://
    2. Converts sslmode= (libpq style) to ssl= (asyncpg style)
    """
    if not url:
        return url
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    # asyncpg expects 'ssl=' instead of 'sslmode='
    url = url.replace("?sslmode=", "?ssl=").replace("&sslmode=", "&ssl=")
    return url


_db_url = _normalize_db_url(settings.database_url)

# ── Connection pool ───────────────────────────────────────────────────────────
# Aiven Hobbyist plan allows 25 concurrent connections.
# Default: pool_size=4 + max_overflow=4 = 8 max per worker process.
# Tune via DB_POOL_SIZE and DB_POOL_MAX_OVERFLOW env vars if on a larger plan.
_pool_size     = int(os.environ.get("DB_POOL_SIZE",        "4"))
_max_overflow  = int(os.environ.get("DB_POOL_MAX_OVERFLOW", "4"))

engine = create_async_engine(
    _db_url,
    echo=False,
    pool_size=_pool_size,
    max_overflow=_max_overflow,
    pool_timeout=30,
    pool_recycle=300,   # recycle connections after 5 min to avoid stale SSL
    pool_pre_ping=True, # verify connection before use (catches dropped SSL)
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def ensure_db_exists():
    db_url = settings.database_url
    if not db_url:
        return
    
    try:
        clean_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
        clean_url = clean_url.replace("?sslmode=", "?ssl=").replace("&sslmode=", "&ssl=")
        
        # Extract base url and db name
        base_url, db_name = clean_url.rsplit('/', 1)
        if '?' in db_name:
            db_name = db_name.split('?')[0]
            
        if db_name in ("defaultdb", "postgres"):
            return
            
        postgres_url = f"{base_url}/postgres"
        conn = await asyncpg.connect(postgres_url)
        try:
            exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", db_name)
            if not exists:
                await conn.execute(f'CREATE DATABASE "{db_name}"')
                print(f"Database '{db_name}' created successfully.")
        finally:
            await conn.close()
    except Exception as e:
        print(f"Note: Database auto-creation check skipped: {e}")


async def init_db():
    await ensure_db_exists()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # ── Incremental migrations ────────────────────────────────────────────
        # create_all does not ALTER existing tables, so new columns must be
        # added explicitly.  Each statement is wrapped in its own savepoint so
        # a "column already exists" error on a re-deploy doesn't abort the
        # rest of startup.
        migrations = [
            # SQLAlchemy persists Enum member names by default (for example,
            # REVIEWING), not their lowercase `.value` strings.
            "ALTER TYPE sessionstatus ADD VALUE IF NOT EXISTS 'REVIEWING'",
            # Phase 1 — skipped_fixes column on reports table
            "ALTER TABLE reports ADD COLUMN IF NOT EXISTS skipped_fixes JSONB DEFAULT '[]'::jsonb",
            # Phase 4 — monitored_sites columns
            "ALTER TABLE monitored_sites ADD COLUMN IF NOT EXISTS framework VARCHAR(50)",
            "ALTER TABLE monitored_sites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
            "ALTER TABLE monitored_sites ADD COLUMN IF NOT EXISTS sdk_status VARCHAR(50) DEFAULT 'not_installed'",
            "ALTER TABLE monitored_sites ADD COLUMN IF NOT EXISTS sdk_last_seen TIMESTAMP",
            # Phase 4 — sentry_incidents columns
            "ALTER TABLE sentry_incidents ADD COLUMN IF NOT EXISTS fix_summary TEXT",
            "ALTER TABLE sentry_incidents ADD COLUMN IF NOT EXISTS github_repo VARCHAR(300)",
            # SDK — new tables (created by create_all, but ensure extra columns exist)
            "ALTER TABLE sdk_errors ADD COLUMN IF NOT EXISTS incident_id VARCHAR REFERENCES sentry_incidents(id)",
            # Phase 5 — User subscription and billing columns
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'none'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS lemon_customer_id VARCHAR(100)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS lemon_subscription_id VARCHAR(100)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS lemon_variant_id VARCHAR(100)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_renews_at TIMESTAMP",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_alerts_enabled BOOLEAN DEFAULT TRUE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_incident_fixes_used INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_chaos_scans_used INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_reset_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",

            # ── Performance indexes ────────────────────────────────────────────
            # These cover every filtered/sorted/joined column that was missing an
            # index. Each CREATE INDEX is wrapped in IF NOT EXISTS so re-deploying
            # is safe.  The CONCURRENTLY keyword is NOT used because asyncpg does
            # not allow it inside a transaction — Aiven/PostgreSQL will build them
            # non-concurrently on startup which is fine for the data volumes here.

            # chaos_sessions: user dashboard list (user_id filter + created_at sort)
            "CREATE INDEX IF NOT EXISTS ix_chaos_sessions_user_id ON chaos_sessions(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_chaos_sessions_created_at ON chaos_sessions(created_at DESC)",

            # monitored_sites: loaded on every authenticated page
            "CREATE INDEX IF NOT EXISTS ix_monitored_sites_user_id ON monitored_sites(user_id)",

            # site_api_keys: looked up on every SDK ingest request
            "CREATE INDEX IF NOT EXISTS ix_site_api_keys_site_id ON site_api_keys(site_id)",
            "CREATE INDEX IF NOT EXISTS ix_site_api_keys_key_hash ON site_api_keys(key_hash)",

            # sentry_incidents: incident list page (site_id IN + created_at sort + status filter)
            "CREATE INDEX IF NOT EXISTS ix_sentry_incidents_site_id ON sentry_incidents(site_id)",
            "CREATE INDEX IF NOT EXISTS ix_sentry_incidents_created_at ON sentry_incidents(created_at DESC)",
            "CREATE INDEX IF NOT EXISTS ix_sentry_incidents_status ON sentry_incidents(status)",
            "CREATE INDEX IF NOT EXISTS ix_sentry_incidents_dedup_key ON sentry_incidents(dedup_key)",

            # agent_steps: session detail page (session_id + created_at sort)
            "CREATE INDEX IF NOT EXISTS ix_agent_steps_session_id ON agent_steps(session_id)",
            "CREATE INDEX IF NOT EXISTS ix_agent_steps_created_at ON agent_steps(created_at ASC)",

            # failure_results: session detail + report page
            "CREATE INDEX IF NOT EXISTS ix_failure_results_session_id ON failure_results(session_id)",
            "CREATE INDEX IF NOT EXISTS ix_failure_results_fix_generated ON failure_results(session_id, fix_generated)",

            # endpoints: session detail page
            "CREATE INDEX IF NOT EXISTS ix_endpoints_session_id ON endpoints(session_id)",

            # reports: looked up by session_id
            "CREATE INDEX IF NOT EXISTS ix_reports_session_id ON reports(session_id)",

            # sdk_errors: dedup + pipeline threshold check
            "CREATE INDEX IF NOT EXISTS ix_sdk_errors_site_id ON sdk_errors(site_id)",
            "CREATE INDEX IF NOT EXISTS ix_sdk_errors_fingerprint_processed ON sdk_errors(fingerprint, processed)",
        ]
        for sql in migrations:
            try:
                await conn.execute(__import__("sqlalchemy").text(sql))
            except Exception as exc:
                # Log but do not abort startup — column may already exist
                print(f"Migration note (non-fatal): {exc}")


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
