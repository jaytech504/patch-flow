from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from backend.core.config import get_settings
from backend.core.websocket_manager import ws_manager
from backend.db.session import init_db
from backend.api import sessions, reports, github, auth, discovery, sites, incidents, billing
from backend.api import sdk as sdk_api

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Chaos Agent...")
    await init_db()
    logger.info("Database ready.")
    yield
    logger.info("Chaos Agent stopped.")


app = FastAPI(
    title="Chaos Agent",
    description="Autonomous API failure injection and error handling code generator",
    version="1.0.0",
    lifespan=lifespan,
)

import os

# ── Allowed CORS origins ───────────────────────────────────────────────────────
# Always includes the configured FRONTEND_URL plus any extra origins from
# the CORS_ORIGINS env var (comma-separated). In development localhost is
# added automatically so you never need to touch this file.
_frontend_url = settings.frontend_url.rstrip("/")
_extra_origins_raw = os.environ.get("CORS_ORIGINS", "")
_extra_origins = [o.strip().rstrip("/") for o in _extra_origins_raw.split(",") if o.strip()]

ALLOWED_ORIGINS: list[str] = list({
    _frontend_url,
    "http://localhost:3000",
    "https://localhost:3000",
    *_extra_origins,
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(discovery.router, prefix="/api/discovery", tags=["discovery"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(github.router, prefix="/api/github", tags=["github"])
app.include_router(sites.router, prefix="/api/sites", tags=["sites"])
app.include_router(incidents.router, prefix="/api/incidents", tags=["incidents"])
app.include_router(billing.router, prefix="/api/billing", tags=["billing"])
app.include_router(sdk_api.router, prefix="/api/sdk", tags=["sdk"])


@app.websocket("/ws/{session_id}")
async def websocket_session(ws: WebSocket, session_id: str):
    await ws_manager.connect(ws, session_id)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(ws, session_id)


from sqlalchemy import text
from backend.db.session import AsyncSessionLocal

@app.api_route("/health", methods=["GET", "HEAD", "POST"])
@app.api_route("/api/health", methods=["GET", "HEAD", "POST"])
async def health():
    db_status = "healthy"
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"[Health] Database ping failed: {e}")
        db_status = f"unhealthy: {e}"

    return {
        "status": "ok" if db_status == "healthy" else "degraded",
        "service": "patchflow-api",
        "database": db_status,
        "github_integration": bool(settings.github_token),
    }
