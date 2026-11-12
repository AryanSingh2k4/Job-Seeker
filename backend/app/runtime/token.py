"""Per-launch bearer token generation and constant-time validation."""

from __future__ import annotations

import hmac
import secrets


def generate_token() -> str:
    """Generate 32 random bytes (base64url encoded)."""
    return secrets.token_urlsafe(32)


def validate_token(provided: str | None, expected: str | None) -> bool:
    """Constant-time comparison of bearer tokens."""
    if not provided or not expected:
        return False
    return hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8"))
