import pytest
from fastapi import HTTPException
from backend.core.security_guards import validate_target_url, InMemoryRateLimiter


def test_validate_target_url_public_domain():
    # Google DNS should resolve and pass
    url = "https://dns.google/resolve"
    res = validate_target_url(url, allow_localhost_in_dev=False)
    assert res == url


def test_validate_target_url_invalid_scheme():
    with pytest.raises(HTTPException) as exc:
        validate_target_url("ftp://example.com/file")
    assert exc.value.status_code == 400
    assert "scheme" in exc.value.detail


def test_validate_target_url_blocked_metadata():
    with pytest.raises(HTTPException) as exc:
        validate_target_url("http://169.254.169.254/latest/meta-data", allow_localhost_in_dev=False)
    assert exc.value.status_code == 400


def test_validate_target_url_private_ip():
    with pytest.raises(HTTPException) as exc:
        validate_target_url("http://192.168.1.1:8000/api", allow_localhost_in_dev=False)
    assert exc.value.status_code == 400
    assert "private or internal" in exc.value.detail


def test_rate_limiter():
    limiter = InMemoryRateLimiter(requests_per_minute=3, burst_limit=3)
    key = "user_123"

    # 3 allowed
    assert limiter.check(key)[0] is True
    assert limiter.check(key)[0] is True
    assert limiter.check(key)[0] is True

    # 4th should be rejected
    allowed, retry_after = limiter.check(key)
    assert allowed is False
    assert retry_after > 0
