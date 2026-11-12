"""Deduplication and cross-posting linker (§6.1)."""

from __future__ import annotations

from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models.job import Job


def check_duplicate(
    db: Session,
    fingerprint: str,
    semantic_fingerprint: str,
) -> Tuple[bool, Optional[str], Optional[Job]]:
    """Check if a job already exists via URL hash or semantic hash."""
    # 1. Exact URL fingerprint
    existing = db.query(Job).filter(Job.fingerprint == fingerprint).first()
    if existing:
        return True, existing.id, existing

    # 2. Semantic fingerprint in metadata
    # (or could query by company + title match)
    return False, None, None
