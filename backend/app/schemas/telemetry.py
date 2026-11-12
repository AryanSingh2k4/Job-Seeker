"""WebSocket telemetry schemas for JobSeeker.

Follows the exact shapes defined in docs/BACKEND_IMPLEMENTATION_SPEC.md §8.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field


class ApplicationStagePayload(BaseModel):
    applicationId: str
    jobId: str
    company: str
    stage: str  # NAVIGATING|FILLING_FIELDS|UPLOADING_RESUME|ANSWERING_QA|PAUSED_FOR_REVIEW|SUBMITTED|FAILED
    currentStep: int
    totalSteps: int


class QAAnswerSummary(BaseModel):
    question: str
    answer: str
    confidence: float


class HITLReviewPayload(BaseModel):
    applicationId: str
    company: str
    title: str
    tailoredResumePdfUrl: str
    qaAnswers: List[QAAnswerSummary] = Field(default_factory=list)


class CaptchaChallengePayload(BaseModel):
    applicationId: str
    company: str
    captchaType: str  # CLOUDFLARE_TURNSTILE|RECAPTCHA|ARKOSE_PUZZLE


class RateLimitUpdatePayload(BaseModel):
    dailyLinkedInUsed: int
    dailyLinkedInLimit: int
    dailyATSUsed: int
    dailyATSLimit: int
    resetsAt: str


class SweepCompletedPayload(BaseModel):
    sweepId: str
    new_jobs: int
    duplicate: int
    filtered: int


class TelemetryEvent(BaseModel):
    type: str
    payload: Dict[str, Any]
