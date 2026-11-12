"""Settings routes for JobSeeker (§7.6)."""

from __future__ import annotations

import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.errors import AppException
from app.models.settings import AppSetting
from app.schemas.settings import (
    DailyCaps,
    LLMKeyRequest,
    LLMSettings,
    PlatformOptInRequest,
    SettingsOut,
    SettingsUpdate,
    WorkingHours,
)
from app.secrets import set_secret

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULT_SETTINGS = {
    "mode": "assisted",
    "autonomous_opt_in": False,
    "linkedin_opt_in": False,
    "daily_caps": {"linkedin": 25, "ats": 40, "global": 20},
    "working_hours": {"start": "08:30", "end": "18:30", "days": [0, 1, 2, 3, 4]},
    "company_cooldown_days": 14,
    "crawl_interval_minutes": 5,
    "crawl_max_companies_per_day": 50,
    "llm": {
        "provider": "openai",
        "model": "gpt-4o-mini",
        "model_strong": "gpt-4o",
        "monthly_budget_usd": 30.0,
        "spend_this_month_usd": 0.0,
    },
    "inter_application_cooldown_min": [3, 8],
}


def load_settings(db: Session) -> dict:
    row = db.query(AppSetting).filter(AppSetting.key == "system_settings").first()
    if not row:
        row = AppSetting(key="system_settings", value=json.dumps(DEFAULT_SETTINGS))
        db.add(row)
        db.commit()
        db.refresh(row)
    data = json.loads(row.value)
    merged = {**DEFAULT_SETTINGS, **data}
    return merged


def save_settings(db: Session, data: dict) -> None:
    row = db.query(AppSetting).filter(AppSetting.key == "system_settings").first()
    if not row:
        row = AppSetting(key="system_settings", value=json.dumps(data))
        db.add(row)
    else:
        row.value = json.dumps(data)
    db.commit()


@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)) -> SettingsOut:
    data = load_settings(db)
    return SettingsOut(
        mode=data.get("mode", "assisted"),
        autonomous_opt_in=data.get("autonomous_opt_in", False),
        linkedin_opt_in=data.get("linkedin_opt_in", False),
        daily_caps=DailyCaps(**data.get("daily_caps", {})),
        working_hours=WorkingHours(**data.get("working_hours", {})),
        company_cooldown_days=data.get("company_cooldown_days", 14),
        crawl_interval_minutes=data.get("crawl_interval_minutes", 30),
        llm=LLMSettings(**data.get("llm", {})),
        inter_application_cooldown_min=data.get("inter_application_cooldown_min", [3, 8]),
    )


@router.post("", response_model=SettingsOut)
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)) -> SettingsOut:
    data = load_settings(db)
    if payload.mode is not None:
        data["mode"] = payload.mode
    if payload.autonomous_opt_in is not None:
        data["autonomous_opt_in"] = payload.autonomous_opt_in
    if payload.daily_caps is not None:
        caps_dict = payload.daily_caps.model_dump(by_alias=True)
        data["daily_caps"] = caps_dict
    if payload.working_hours is not None:
        data["working_hours"] = payload.working_hours.model_dump()
    if payload.company_cooldown_days is not None:
        data["company_cooldown_days"] = payload.company_cooldown_days
    if payload.crawl_interval_minutes is not None:
        data["crawl_interval_minutes"] = payload.crawl_interval_minutes
    if payload.llm is not None:
        data["llm"] = payload.llm.model_dump()
    if payload.inter_application_cooldown_min is not None:
        data["inter_application_cooldown_min"] = payload.inter_application_cooldown_min

    save_settings(db, data)
    return get_settings(db)


@router.post("/platform-optin", response_model=SettingsOut)
def platform_optin(payload: PlatformOptInRequest, db: Session = Depends(get_db)) -> SettingsOut:
    if payload.platform.lower() != "linkedin":
        raise AppException(
            code="validation_error",
            message=f"Unknown platform for opt-in: {payload.platform}",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    if payload.acknowledgment != "I UNDERSTAND THE RISK":
        raise AppException(
            code="linkedin_not_opted_in",
            message="Must provide exact acknowledgment phrase 'I UNDERSTAND THE RISK'",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    data = load_settings(db)
    data["linkedin_opt_in"] = True
    save_settings(db, data)
    return get_settings(db)


@router.post("/llm-key", status_code=status.HTTP_200_OK)
def set_llm_key(payload: LLMKeyRequest) -> dict:
    if not payload.api_key or not payload.api_key.strip():
        raise AppException(
            code="validation_error",
            message="API key cannot be empty",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    set_secret("LLM_API_KEY", payload.api_key.strip())
    return {"status": "ok"}
