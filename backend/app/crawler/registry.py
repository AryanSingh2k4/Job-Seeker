"""Company board token registry for JobSeeker crawler (§6.1)."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.settings import AppSetting

logger = logging.getLogger(__name__)


def load_registry_seed() -> List[Dict[str, Any]]:
    """Load verified company registry seed from fixtures."""
    settings = get_settings()
    seed_path = settings.fixtures_dir / "company_registry.json"
    if seed_path.is_file():
        try:
            with seed_path.open("r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("companies", [])
        except Exception as exc:
            logger.error("Failed to load company_registry.json: %s", exc)
    return []


def get_active_companies(db: Session) -> List[Dict[str, Any]]:
    """Return all active company sources, combining seed with DB additions/overrides."""
    seed_companies = load_registry_seed()
    seed_map = {c["company"].lower(): c for c in seed_companies}

    # Check for DB overrides/additions
    row = db.query(AppSetting).filter(AppSetting.key == "company_sources").first()
    if row and row.value:
        try:
            custom_sources = json.loads(row.value)
            for cs in custom_sources:
                cname = cs.get("company", "").lower()
                if cname:
                    seed_map[cname] = {**seed_map.get(cname, {}), **cs}
        except Exception as exc:
            logger.error("Failed to parse custom company_sources: %s", exc)

    return list(seed_map.values())
