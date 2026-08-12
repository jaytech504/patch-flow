"""
Sentry API client for Phase 4 incident pipeline.

Fetches:
  - Issue metadata (title, count, users affected, environment)
  - Recommended event (latest occurrence with full stack trace)
  - Release info (version, commit SHA, repo)
  - Stack frames from the recommended event

All responses are passed through the redactor before being returned.
"""

from __future__ import annotations

import httpx
from loguru import logger
from typing import Optional

from backend.core.redactor import redact_dict, redact_stack_frame


class SentryClient:
    BASE = "https://sentry.io/api/0"

    def __init__(self, auth_token: str, org: str):
        self._token = auth_token
        self._org = org
        self._headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json",
        }

    # ── Issues ────────────────────────────────────────────────────────────────

    async def get_issue(self, issue_id: str) -> dict:
        """Fetch issue metadata including counts and environment."""
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{self.BASE}/issues/{issue_id}/",
                headers=self._headers,
            )
            r.raise_for_status()
            data = r.json()

        return {
            "id": data.get("id", issue_id),
            "title": data.get("title", ""),
            "culprit": data.get("culprit", ""),
            "permalink": data.get("permalink", ""),
            "status": data.get("status", ""),
            "level": data.get("level", "error"),
            "count": int(data.get("count", 0)),
            "user_count": int(data.get("userCount", 0)),
            "project": data.get("project", {}).get("slug", ""),
            "first_seen": data.get("firstSeen", ""),
            "last_seen": data.get("lastSeen", ""),
            "is_regression": data.get("isRegression", False),
        }

    # ── Events ────────────────────────────────────────────────────────────────

    async def get_latest_event(self, issue_id: str) -> dict:
        """
        Fetch the recommended (latest) event for an issue.
        Returns a redacted payload with stack frames.
        """
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                f"{self.BASE}/issues/{issue_id}/events/latest/",
                headers=self._headers,
                params={"full": "true"},
            )
            r.raise_for_status()
            data = r.json()

        return self._parse_event(data)

    def _parse_event(self, event: dict) -> dict:
        """Extract and redact the fields PatchFlow needs from a Sentry event."""
        # Pull stack frames from exception values
        frames: list[dict] = []
        exception = event.get("exception") or {}
        for exc_val in (exception.get("values") or []):
            raw_frames = (exc_val.get("stacktrace") or {}).get("frames") or []
            for f in raw_frames:
                frames.append(redact_stack_frame(f))

        # Also check top-level stacktrace
        if not frames:
            top_st = event.get("stacktrace") or {}
            for f in (top_st.get("frames") or []):
                frames.append(redact_stack_frame(f))

        # Top frame = most relevant (last in Sentry's list)
        top_frame = frames[-1] if frames else {}

        # Request context — redact headers/cookies
        req = event.get("request") or {}
        safe_request = {
            "url": req.get("url", ""),
            "method": req.get("method", ""),
        }

        # Exception info
        exc_values = (exception.get("values") or [])
        exc_info = exc_values[-1] if exc_values else {}

        return {
            "event_id": event.get("eventID", ""),
            "release": event.get("release", ""),
            "environment": event.get("environment", ""),
            "platform": event.get("platform", ""),
            "error_type": exc_info.get("type", ""),
            "error_value": redact_dict(exc_info.get("value", "")),
            "frames": frames,
            "top_frame": top_frame,
            "request": safe_request,
            "tags": redact_dict({t["key"]: t["value"] for t in (event.get("tags") or [])}),
        }

    # ── Releases ──────────────────────────────────────────────────────────────

    async def get_release(self, project: str, version: str) -> Optional[dict]:
        """
        Fetch release info including commit SHA if available.
        Returns None if the release cannot be found.
        """
        if not version:
            return None
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(
                    f"{self.BASE}/organizations/{self._org}/releases/{version}/",
                    headers=self._headers,
                )
                if r.status_code == 404:
                    logger.warning(f"[Sentry] Release not found: {version}")
                    return None
                r.raise_for_status()
                data = r.json()

            # Extract first commit SHA if present
            commits = data.get("commits") or []
            commit_sha = commits[0].get("id", "") if commits else ""
            ref = data.get("ref", "")

            return {
                "version": data.get("version", version),
                "commit_sha": commit_sha or ref,
                "date_released": data.get("dateReleased", ""),
                "projects": [p.get("slug", "") for p in (data.get("projects") or [])],
            }
        except Exception as e:
            logger.warning(f"[Sentry] Could not fetch release {version}: {e}")
            return None

    # ── Projects ──────────────────────────────────────────────────────────────

    async def list_projects(self) -> list[dict]:
        """List all Sentry projects in the org (for the Sites UI)."""
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(
                    f"{self.BASE}/organizations/{self._org}/projects/",
                    headers=self._headers,
                )
                r.raise_for_status()
                data = r.json()
            return [
                {
                    "slug": p.get("slug", ""),
                    "name": p.get("name", ""),
                    "platform": p.get("platform", ""),
                }
                for p in data
            ]
        except Exception as e:
            logger.warning(f"[Sentry] Could not list projects: {e}")
            return []
