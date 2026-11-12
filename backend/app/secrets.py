"""Keyring secrets management for JobSeeker (§7)."""

from __future__ import annotations

import logging
from typing import Optional
import keyring

logger = logging.getLogger(__name__)
SERVICE_NAME = "JobSeeker"

# In-memory fallback if OS keyring is unavailable
_MEMORY_VAULT: dict[str, str] = {}


def set_secret(key: str, value: str) -> None:
    try:
        keyring.set_password(SERVICE_NAME, key, value)
    except Exception as exc:
        logger.warning("OS keyring unavailable, falling back to memory vault: %s", exc)
        _MEMORY_VAULT[key] = value


def get_secret(key: str) -> Optional[str]:
    try:
        val = keyring.get_password(SERVICE_NAME, key)
        if val is not None:
            return val
    except Exception as exc:
        logger.warning("OS keyring read failed: %s", exc)
    return _MEMORY_VAULT.get(key)


def delete_secret(key: str) -> None:
    try:
        keyring.delete_password(SERVICE_NAME, key)
    except Exception:
        pass
    _MEMORY_VAULT.pop(key, None)
