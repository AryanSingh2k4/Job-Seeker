"""Health response schema for JobSeeker.

Follows the exact shape defined in docs/BACKEND_IMPLEMENTATION_SPEC.md §7.0.
"""

from __future__ import annotations

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class BrowserHealth(BaseModel):
    running: bool = False


class LLMHealth(BaseModel):
    configured: bool = False
    degraded: bool = False


class SchedulerHealth(BaseModel):
    crawl: str = "idle"
    match: str = "idle"
    apply: str = "idle"


class CapUsage(BaseModel):
    used: int = 0
    limit: int = 0


class CapsToday(BaseModel):
    linkedin: CapUsage = Field(default_factory=lambda: CapUsage(used=0, limit=25))
    ats: CapUsage = Field(default_factory=lambda: CapUsage(used=0, limit=40))


class RuntimeInfo(BaseModel):
    mode: str = "dev"
    port: int = 8000
    schema_version: str = "0001"
    browser_executable: Optional[str] = None


class HealthResponse(BaseModel):
    status: str = "ok"
    db: bool = True
    browser: BrowserHealth = Field(default_factory=BrowserHealth)
    llm: LLMHealth = Field(default_factory=LLMHealth)
    scheduler: SchedulerHealth = Field(default_factory=SchedulerHealth)
    caps_today: CapsToday = Field(default_factory=CapsToday)
    version: str = "2.0.0"
    contract_version: str = "1"
    runtime: Optional[RuntimeInfo] = None
