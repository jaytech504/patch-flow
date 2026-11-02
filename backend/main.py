import os
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

# ── Allowed CORS origins ───────────────────────────────────────────────────────
# Primary origin: FRONTEND_URL env var (must be https://patchflow.cloud in prod).
# Extra origins: comma-separated CORS_ORIGINS env var for staging/preview URLs.
# Localhost variants are always allowed so local dev works without env changes.
_frontend_url = settings.frontend_url.rstrip("/")
_extra_origins = [
    o.strip().rstrip("/")
    for o in os.environ.get("CORS_ORIGINS", "").split(",")
    if o.strip()
]

ALLOWED_ORIGINS: list[str] = list({
    _frontend_url,
    # Always allow both www and non-www of the production domain
    "https://patchflow.cloud",
    "https://www.patchflow.cloud",
    # Local development
    "http://localhost:3000",
    "https://localhost:3000",
    *_extra_origins,
})


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting PatchFlow API...")
    logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")
    await init_db()
    logger.info("Database ready.")
    yield
    logger.info("PatchFlow API stopped.")


app = FastAPI(
    title="PatchFlow API",
    description="Autonomous API failure injection and self-healing platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
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
