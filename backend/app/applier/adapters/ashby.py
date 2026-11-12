"""Ashby ATS Platform Adapter (§4.4, §12)."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any, Callable

from playwright.async_api import Page

from app.applier.adapters.base import ApplicationSubmissionResult, BaseAdapter
from app.applier.humanize import human_type
from app.applier.qa import QAResolver, ScreeningQuestion
from app.schemas.profile import CandidateProfileOut

logger = logging.getLogger(__name__)


class AshbyAdapter(BaseAdapter):
    """Adapter for Ashby job application pages."""

    platform_name = "ASHBY"

    def can_handle(self, url: str, html: str = "") -> bool:
        if "ashbyhq.com" in url.lower():
            return True
        if 'data-ashby="application"' in html or 'ashby' in html.lower():
            return True
        return False

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
        qa_records: list[dict[str, Any]] = []
        resolver = QAResolver(profile)

        try:
            logger.info("Ashby: Locating form fields")
            await page.wait_for_selector("form, input[name='name'], input[name='email']", timeout=10000)

            # Name
            name_input = page.locator("input[name='name'], input[autocomplete='name']")
            if await name_input.count() > 0:
                await human_type(name_input.first, profile.full_name, fast_mode=fast_mode)

            # Email
            email_input = page.locator("input[name='email'], input[autocomplete='email']")
            if await email_input.count() > 0:
                await human_type(email_input.first, profile.email, fast_mode=fast_mode)

            # Phone
            phone_input = page.locator("input[name='phone'], input[autocomplete='tel']")
            if await phone_input.count() > 0:
                await human_type(phone_input.first, profile.phone, fast_mode=fast_mode)

            # Resume
            if resume_pdf_path and resume_pdf_path.is_file():
                file_input = page.locator("input[type='file']")
                if await file_input.count() > 0:
                    await file_input.first.set_input_files(str(resume_pdf_path.resolve()))

            # Assisted Review Pause
            if submission_mode == "ASSISTED_REVIEW" and approval_event is not None:
                logger.info("Ashby: Pausing for review approval...")
                await approval_event.wait()

            # Submit
            submit_btn = page.locator("button[type='submit'], button:has-text('Submit Application')")
            if await submit_btn.count() > 0:
                await submit_btn.first.click()

            screenshot_dir = Path("data/screenshots")
            screenshot_dir.mkdir(parents=True, exist_ok=True)
            screenshot_file = screenshot_dir / "ashby_submission.png"
            await page.screenshot(path=str(screenshot_file))

            return ApplicationSubmissionResult(
                status="SUBMITTED",
                confirmation_receipt="ASHBY-CONFIRMED",
                screenshot_path=str(screenshot_file),
                qa_audit_records=qa_records,
            )

        except Exception as e:
            logger.error("Ashby submission failed: %s", e)
            return ApplicationSubmissionResult(
                status="FAILED",
                failure_stage="FINAL_SUBMIT",
                failure_reason=str(e),
                qa_audit_records=qa_records,
            )
