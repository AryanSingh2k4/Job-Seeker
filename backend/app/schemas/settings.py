"""Settings and Browser schemas for JobSeeker.

Follows the exact shapes defined in docs/BACKEND_IMPLEMENTATION_SPEC.md §7.5 & §7.6.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DailyCaps(BaseModel):
    linkedin: int = 25
    ats: int = 40
    global_: int = Field(20, alias="global")

    model_config = {"populate_by_name": True}


class WorkingHours(BaseModel):
    start: str = "08:30"
    end: str = "18:30"
    days: List[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4])


class LLMSettings(BaseModel):
    provider: str = "openai"
    model: str = "gpt-4o-mini"
    model_strong: str = "gpt-4o"
    monthly_budget_usd: float = 30.0
    spend_this_month_usd: float = 0.0


class SettingsOut(BaseModel):
    mode: str = "assisted"
    autonomous_opt_in: bool = False
    linkedin_opt_in: bool = False
    daily_caps: DailyCaps = Field(default_factory=DailyCaps)
    working_hours: WorkingHours = Field(default_factory=WorkingHours)
    company_cooldown_days: int = 14
    crawl_interval_minutes: int = 5
    crawl_max_companies_per_day: int = 50
    llm: LLMSettings = Field(default_factory=LLMSettings)
    inter_application_cooldown_min: List[int] = Field(default_factory=lambda: [3, 8])


class SettingsUpdate(BaseModel):
    mode: Optional[str] = None
    autonomous_opt_in: Optional[bool] = None
    daily_caps: Optional[DailyCaps] = None
    working_hours: Optional[WorkingHours] = None
    company_cooldown_days: Optional[int] = None
    crawl_interval_minutes: Optional[int] = None
    crawl_max_companies_per_day: Optional[int] = None
    llm: Optional[LLMSettings] = None
    inter_application_cooldown_min: Optional[List[int]] = None


class PlatformOptInRequest(BaseModel):
    platform: str = "linkedin"
    acknowledgment: str


class LLMKeyRequest(BaseModel):
    api_key: str


class BrowserStatusResponse(BaseModel):
    running: bool = False
    executable: Optional[str] = None
    profile_path: Optional[str] = None
    logged_in: Dict[str, Any] = Field(default_factory=lambda: {"linkedin": False, "workday": []})
