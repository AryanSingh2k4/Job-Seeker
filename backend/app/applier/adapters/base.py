"""Base Platform Adapter interface (§4, §12)."""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from playwright.async_api import Page

from app.schemas.profile import CandidateProfileOut


@dataclass
class ApplicationSubmissionResult:
    status: str  # SUBMITTED | PAUSED_FOR_REVIEW | FAILED | BLOCKED | CAPTCHA_BLOCKED | DISCARDED
    confirmation_receipt: str | None = None
    screenshot_path: str | None = None
    failure_stage: str | None = None  # INITIAL_LOAD | CONTACT_FIELDS | QA_FIELDS | FILE_UPLOAD | FINAL_SUBMIT
    failure_reason: str | None = None
    qa_audit_records: list[dict[str, Any]] = field(default_factory=list)


class BaseAdapter(ABC):
    """Abstract base class for all job application ATS adapters."""

    platform_name: str = "GENERIC"

    @abstractmethod
    def can_handle(self, url: str, html: str = "") -> bool:
        """Check whether this adapter matches the target application URL or DOM."""
        pass

    @abstractmethod
    async def fill_and_submit(
        self,
        page: Page,
        profile: CandidateProfileOut,
        resume_pdf_path: Path,
        cover_letter: str | None = None,
        submission_mode: str = "ASSISTED_REVIEW",
        approval_event: asyncio.Event | None = None,
        on_qa_answered: Callable[[dict[str, Any]], None] | None = None,
        fast_mode: bool = False,
    ) -> ApplicationSubmissionResult:
        """Execute the multi-step application form filling, review, and submission."""
        pass
