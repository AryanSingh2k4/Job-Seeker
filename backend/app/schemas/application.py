"""Application schemas for JobSeeker.

Follows the exact shape defined in docs/BACKEND_IMPLEMENTATION_SPEC.md §7.4.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ApplicationListItem(BaseModel):
    id: str
    job_id: str
    company: str
    title: str
    platform: str
    submission_mode: str = "ASSISTED_REVIEW"
    status: str = "QUEUED"
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: int = 0
    confirmation_receipt: Optional[str] = None
    screenshot_path: Optional[str] = None
    failure_stage: Optional[str] = None
    failure_reason: Optional[str] = None


class ApplicationPage(BaseModel):
    items: List[ApplicationListItem]
    total: int
    page: int
    page_size: int


class QAAnswerAuditItem(BaseModel):
    id: Optional[str] = None
    question_text: str
    answer_value: str
    resolution_tier: str  # DETERMINISTIC | LLM_GENERATED | USER_OVERRIDE | UNRESOLVED
    confidence_score: float
    user_verified: bool = False
    timestamp: Optional[datetime] = None


class AuditLogItem(BaseModel):
    id: str
    entity_type: str
    entity_id: Optional[str] = None
    event_type: str
    severity: str = "INFO"
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime


class ApplicationDetail(ApplicationListItem):
    qa_answers: List[QAAnswerAuditItem] = Field(default_factory=list)
    events: List[AuditLogItem] = Field(default_factory=list)


class ApplicationStartResponse(BaseModel):
    application_id: str
    status: str = "QUEUED"


class ApplicationActionResponse(BaseModel):
    status: str


class ApplicationStats(BaseModel):
    total_applications: int = 0
    submitted_count: int = 0
    failed_count: int = 0
    paused_count: int = 0
    blocked_count: int = 0
    by_platform: Dict[str, int] = Field(default_factory=dict)
    average_duration_seconds: float = 0.0
