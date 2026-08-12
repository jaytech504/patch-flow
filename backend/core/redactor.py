"""
Redactor — strips PII and secrets from SDK error payloads before they touch
the LLM, the database, or PR descriptions.

Patterns scrubbed:
  - Passwords / secrets / tokens in key=value pairs
  - Bearer / Basic auth headers
  - Database connection strings
  - Email addresses
  - IPv4 addresses
  - Private keys (PEM blocks)
  - AWS / GCP / Azure credential patterns
  - DSN URLs containing project keys
"""

from __future__ import annotations

import re
from typing import Any

# ── Regex patterns ────────────────────────────────────────────────────────────

_PATTERNS: list[tuple[str, str]] = [
    # key=value secrets (password, secret, token, key, api_key, auth …)
    (
        r'(?i)(password|passwd|secret|token|api[_-]?key|auth[_-]?token|access[_-]?key'
        r'|private[_-]?key|client[_-]?secret|credentials?)\s*[=:]\s*\S+',
        r"\1=***REDACTED***",
    ),
    # Bearer / Basic auth headers
    (r"(?i)(Bearer|Basic)\s+[A-Za-z0-9+/=._\-]{8,}", r"\1 ***REDACTED***"),
    # Database DSNs  (postgres://, mysql://, mongodb://, redis://)
    (
        r"(?i)(postgres(?:ql)?|mysql|mongodb|redis|amqp)://[^@\s]+@[^\s\"']+",
        r"\1://***REDACTED***",
    ),
    # DSN URLs containing project keys (e.g. error tracking DSNs)
    (
        r"https://[a-f0-9]{32}@o\d+\.ingest(?:\.us)?\.sentry\.io/\d+",
        "https://***REDACTED***@ingest.example/***",
    ),
    # AWS access/secret keys
    (r"(?<![A-Z0-9])[A-Z0-9]{20}(?![A-Z0-9])", "***AWS_KEY***"),
    (r"(?<![a-zA-Z0-9/+])[a-zA-Z0-9/+]{40}(?![a-zA-Z0-9/+])", "***AWS_SECRET***"),
    # PEM private key blocks
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----",
     "***PRIVATE_KEY_REDACTED***"),
    # Email addresses
    (r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", "***EMAIL***"),
    # IPv4 addresses (keep localhost)
    (
        r"\b(?!127\.0\.0\.1|0\.0\.0\.0|localhost)(?:\d{1,3}\.){3}\d{1,3}\b",
        "***IP***",
    ),
]

_COMPILED = [(re.compile(pat), repl) for pat, repl in _PATTERNS]


def redact_string(text: str) -> str:
    """Apply all redaction patterns to a plain string."""
    if not isinstance(text, str):
        return text
    for pattern, replacement in _COMPILED:
        text = pattern.sub(replacement, text)
    return text


def redact_dict(obj: Any, depth: int = 0) -> Any:
    """
    Recursively redact a dict / list / string.
    Stops at depth 10 to avoid blowing the stack on deeply nested payloads.
    """
    if depth > 10:
        return obj
    if isinstance(obj, dict):
        return {k: redact_dict(v, depth + 1) for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact_dict(item, depth + 1) for item in obj]
    if isinstance(obj, str):
        return redact_string(obj)
    return obj


def redact_stack_frame(frame: dict) -> dict:
    """
    Redact a single stack frame dict.
    Preserves filename, lineno, function — scrubs vars and context lines.
    """
    safe = {
        "filename": frame.get("filename", ""),
        "lineno": frame.get("lineno"),
        "function": frame.get("function", ""),
        "module": frame.get("module", ""),
        "abs_path": frame.get("abs_path", ""),
        # context_line is the actual source code line — safe to keep
        "context_line": redact_string(frame.get("context_line", "") or ""),
        "pre_context": [redact_string(l) for l in (frame.get("pre_context") or [])],
        "post_context": [redact_string(l) for l in (frame.get("post_context") or [])],
        # vars can contain secrets — redact values but keep keys for debugging
        "vars": redact_dict(frame.get("vars") or {}),
    }
    return safe
