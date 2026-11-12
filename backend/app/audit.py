"""Audit log helper for JobSeeker."""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from app.models.application import AuditLog

logger = logging.getLogger(__name__)


def record_audit(
    db: Session,
    entity_type: str,
    event_type: str,
    message: str,
    entity_id: Optional[str] = None,
    severity: str = "INFO",
    details: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    entry = AuditLog(
        id=str(uuid.uuid4()),
        entity_type=entity_type,
        entity_id=entity_id,
        event_type=event_type,
        severity=severity,
        message=message,
        details=details or {},
    )
    try:
        db.add(entry)
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Failed to write audit log: %s", exc)
    return entry
