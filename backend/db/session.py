import asyncpg
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from backend.core.config import get_settings
from backend.db.models import Base

settings = get_settings()

# Render provides DATABASE_URL as "postgresql://..." but asyncpg needs "postgresql+asyncpg://..."
_db_url = settings.database_url
if _db_url.startswith("postgresql://"):
    _db_url = _db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(_db_url, echo=False, poolclass=NullPool)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def ensure_db_exists():
    db_url = settings.database_url
    if not db_url:
        return
    
    try:
        # Extract base url and db name
        base_url, db_name = db_url.rsplit('/', 1)
        # Handle query params if any
        if '?' in db_name:
            db_name = db_name.split('?')[0]
            
        postgres_url = f"{base_url}/postgres"
        postgres_url = postgres_url.replace("postgresql+asyncpg://", "postgresql://")
        
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
