"""Database backup utilities using SQLite VACUUM INTO (§5)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings

logger = logging.getLogger(__name__)


def create_backup(db: Session, prefix: str = "autojob") -> Path:
    settings = get_settings()
    backups_dir = settings.data_dir / "backups"
    backups_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_file = backups_dir / f"{prefix}_{timestamp}.db"

    # SQLite VACUUM INTO requires POSIX style path string
    target_path_str = str(backup_file).replace("\\", "/")
    try:
        db.execute(text(f"VACUUM INTO '{target_path_str}'"))
        db.commit()
        logger.info("Created database backup at %s", backup_file)
    except Exception as exc:
        logger.error("Failed to create database backup: %s", exc)
        raise exc

    return backup_file
