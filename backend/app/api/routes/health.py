"""Health check endpoint for JobSeeker (§7.0)."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.config import get_settings
from app.models.application import Application
from app.schemas.health import (
    BrowserHealth,
    CapsToday,
    CapUsage,
    HealthResponse,
    LLMHealth,
    RuntimeInfo,
    SchedulerHealth,
)
from app.secrets import get_secret

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def get_health(db: Session = Depends(get_db)) -> HealthResponse:
    settings = get_settings()

    # 1. Database check
    db_ok = True
    try:
        db.execute(text("SELECT 1")).scalar()
    except Exception:
        db_ok = False

    # 2. Count today's applications for caps
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    linkedin_used = 0
    ats_used = 0
    if db_ok:
        try:
            li_stmt = select(func.count(Application.id)).where(
                Application.platform == "LINKEDIN",
                Application.started_at >= today_start,
                Application.status.in_(["SUBMITTED", "APPLIED", "PAUSED_FOR_REVIEW"]),
            )
            linkedin_used = db.execute(li_stmt).scalar() or 0

            ats_stmt = select(func.count(Application.id)).where(
                Application.platform != "LINKEDIN",
                Application.started_at >= today_start,
                Application.status.in_(["SUBMITTED", "APPLIED", "PAUSED_FOR_REVIEW"]),
            )
            ats_used = db.execute(ats_stmt).scalar() or 0
        except Exception:
            pass

    # 3. LLM key check
    has_llm_key = bool(get_secret("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY") or os.environ.get("GEMINI_API_KEY"))

    runtime_info = RuntimeInfo(
        mode=os.environ.get("AUTOJOB_RUNTIME_MODE", "dev"),
        port=int(os.environ.get("AUTOJOB_PORT", 8000)),
        schema_version="0001",
        browser_executable=os.environ.get("AUTOJOB_BROWSER_EXECUTABLE"),
    )

    return HealthResponse(
        status="ok" if db_ok else "degraded",
        db=db_ok,
        browser=BrowserHealth(running=False),
        llm=LLMHealth(configured=has_llm_key, degraded=False),
        scheduler=SchedulerHealth(crawl="idle", match="idle", apply="idle"),
        caps_today=CapsToday(
            linkedin=CapUsage(used=linkedin_used, limit=25),
            ats=CapUsage(used=ats_used, limit=40),
        ),
        version="2.0.0",
        contract_version="1",
        runtime=runtime_info,
    )
