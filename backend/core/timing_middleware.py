"""
Request timing middleware.

Logs every request with method, path, status code, and wall-clock duration.
Slow requests (> SLOW_THRESHOLD_MS) are logged at WARNING level so they're
easy to grep in Render logs.

Usage — added in main.py:
    app.add_middleware(TimingMiddleware)
"""
import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from loguru import logger

SLOW_THRESHOLD_MS = 500  # warn on anything over 500ms


class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        log = (
            f"{request.method} {request.url.path} → {response.status_code} "
            f"({duration_ms:.0f}ms)"
        )
        if duration_ms > SLOW_THRESHOLD_MS:
            logger.warning(f"[SLOW] {log}")
        else:
            logger.info(f"[timing] {log}")

        # Expose timing in response header for browser devtools
        response.headers["X-Response-Time"] = f"{duration_ms:.0f}ms"
        return response
