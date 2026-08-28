"""
Security guards for PatchFlow:
1. SSRF (Server-Side Request Forgery) protection for target URLs and OpenAPI spec URLs.
2. Token-bucket in-memory rate limiter for abuse prevention on API endpoints.
"""

import ipaddress
import socket
import time
from urllib.parse import urlparse
from typing import Dict, Tuple
from fastapi import HTTPException, Request, status
from loguru import logger

from backend.core.config import get_settings

settings = get_settings()

# Blocked metadata and cloud internal hosts
BLOCKED_HOSTNAMES = {
    "metadata.google.internal",
    "instance-data",
    "metadata",
}

BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),          # Current network
    ipaddress.ip_network("10.0.0.0/8"),         # Private network RFC 1918
    ipaddress.ip_network("100.64.0.0/10"),      # Shared address space (Carrier-grade NAT)
    ipaddress.ip_network("127.0.0.0/8"),        # Loopback
    ipaddress.ip_network("169.254.0.0/16"),     # Link-local / Cloud metadata (169.254.169.254)
    ipaddress.ip_network("172.16.0.0/12"),      # Private network RFC 1918
    ipaddress.ip_network("192.0.0.0/24"),       # IETF Protocol Assignments
    ipaddress.ip_network("192.0.2.0/24"),       # TEST-NET-1
    ipaddress.ip_network("192.168.0.0/16"),     # Private network RFC 1918
    ipaddress.ip_network("198.18.0.0/15"),      # Network benchmark tests
    ipaddress.ip_network("198.51.100.0/24"),    # TEST-NET-2
    ipaddress.ip_network("203.0.113.0/24"),     # TEST-NET-3
    ipaddress.ip_network("224.0.0.0/4"),        # Multicast
    ipaddress.ip_network("240.0.0.0/4"),        # Reserved / Future use
    ipaddress.ip_network("255.255.255.255/32"), # Broadcast
    ipaddress.ip_network("::1/128"),            # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),           # IPv6 Unique local
    ipaddress.ip_network("fe80::/10"),          # IPv6 Link-local
]


def validate_target_url(url: str, allow_localhost_in_dev: bool = True) -> str:
    """
    Validate that a URL is well-formed, uses http/https, and does not resolve
    to private/internal/cloud-metadata IP addresses (SSRF prevention).
    Returns the normalized URL if valid, or raises HTTPException(400).
    """
    if not url or not isinstance(url, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid URL is required.",
        )

    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL must use http:// or https:// scheme.",
        )

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL must contain a valid domain name or public IP address.",
        )

    # In development mode, allow localhost/127.0.0.1 for local API testing
    is_dev = settings.app_env.lower() in ("development", "dev", "test")
    if is_dev and allow_localhost_in_dev and hostname in ("localhost", "127.0.0.1", "::1"):
        return url.strip()

    if hostname in BLOCKED_HOSTNAMES:
        logger.warning(f"[Security] SSRF attempt blocked for hostname: {hostname}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access to internal metadata services is prohibited.",
        )

    # Resolve hostname to IP address and verify it is not in private/internal networks
    try:
        addr_info = socket.getaddrinfo(hostname, None)
        for _, _, _, _, sockaddr in addr_info:
            ip_str = sockaddr[0]
            ip = ipaddress.ip_address(ip_str)

            # Check if IP falls into any blocked network
            for net in BLOCKED_IP_NETWORKS:
                if ip in net:
                    logger.warning(f"[Security] SSRF attempt blocked: {hostname} resolved to {ip_str} in {net}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Target URL resolves to a private or internal network address, which is not permitted.",
                    )
    except socket.gaierror:
        logger.warning(f"[Security] DNS resolution failed for target host: {hostname}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not resolve host '{hostname}'. Please check the URL.",
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[Security] Error validating target URL {url}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid target URL: {exc}",
        )

    return url.strip()


class InMemoryRateLimiter:
    """
    Sliding window in-memory rate limiter per key (e.g. user_id or client_ip).
    Lightweight, thread-safe, no external Redis dependency required.
    """

    def __init__(self, requests_per_minute: int = 10, burst_limit: int = 15):
        self.rpm = requests_per_minute
        self.burst = burst_limit
        # key -> list of timestamp floats
        self._history: Dict[str, list[float]] = {}

    def _clean_old(self, key: str, now: float):
        one_min_ago = now - 60.0
        if key in self._history:
            self._history[key] = [t for t in self._history[key] if t > one_min_ago]
            if not self._history[key]:
                del self._history[key]

    def check(self, key: str) -> Tuple[bool, int]:
        """
        Check if request is allowed.
        Returns (is_allowed, seconds_to_wait).
        """
        now = time.time()
        self._clean_old(key, now)

        history = self._history.setdefault(key, [])
        if len(history) >= self.burst:
            oldest = history[0]
            retry_after = max(1, int(60.0 - (now - oldest)))
            return False, retry_after

        history.append(now)
        return True, 0


# Pre-configured rate limiters for different endpoint sensitivities
scan_start_limiter = InMemoryRateLimiter(requests_per_minute=6, burst_limit=8)
spec_preview_limiter = InMemoryRateLimiter(requests_per_minute=20, burst_limit=25)
auth_limiter = InMemoryRateLimiter(requests_per_minute=15, burst_limit=20)


def rate_limit(limiter: InMemoryRateLimiter):
    """FastAPI dependency to rate limit by user_id or client IP."""
    async def dependency(request: Request):
        # Extract user_id from token if available, else client host IP
        key = "anonymous"
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.removeprefix("Bearer ").strip()
            key = f"tok_{token[-16:]}" if len(token) >= 16 else token
        else:
            client = request.client
            key = client.host if client else "unknown_ip"

        allowed, retry_after = limiter.check(key)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Please slow down and try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )
    return dependency
