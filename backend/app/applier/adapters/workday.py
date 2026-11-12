"""Workday ATS Platform Adapter (§4.5, §12)."""

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


class WorkdayAdapter(BaseAdapter):
    """Adapter for Workday tenant portals (*.myworkdayjobs.com)."""

    platform_name = "WORKDAY"

    def can_handle(self, url: str, html: str = "") -> bool:
        if "myworkdayjobs.com" in url.lower():
            return True
        if 'data-automation-id="workday"' in html or 'workday' in html.lower():
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
            logger.info("Workday: Starting application workflow")

            # Check for "Apply Manually" button vs "Autofill with Resume"
            apply_manually = page.locator("[data-automation-id='applyManually'], button:has-text('Apply Manually')")
            if await apply_manually.count() > 0:
                await apply_manually.first.click()
                await asyncio.sleep(2.0)

            # Step 1: My Information
            first_name = page.locator("[data-automation-id='legalNameSection_firstName'], input[name='firstName']")
            if await first_name.count() > 0:
                parts = profile.full_name.split()
                await human_type(first_name.first, parts[0] if parts else "Candidate", fast_mode=fast_mode)

            last_name = page.locator("[data-automation-id='legalNameSection_lastName'], input[name='lastName']")
            if await last_name.count() > 0:
                parts = profile.full_name.split()
                await human_type(last_name.first, parts[-1] if len(parts) > 1 else "Candidate", fast_mode=fast_mode)

            email_inp = page.locator("[data-automation-id='email'], input[type='email']")
            if await email_inp.count() > 0:
                await human_type(email_inp.first, profile.email, fast_mode=fast_mode)

            phone_inp = page.locator("[data-automation-id='phone-number'], input[type='tel']")
            if await phone_inp.count() > 0:
                await human_type(phone_inp.first, profile.phone, fast_mode=fast_mode)

            # Resume upload
            if resume_pdf_path and resume_pdf_path.is_file():
                file_input = page.locator("input[type='file']")
                if await file_input.count() > 0:
                    await file_input.first.set_input_files(str(resume_pdf_path.resolve()))

            # Assisted Review Pause
            if submission_mode == "ASSISTED_REVIEW" and approval_event is not None:
                logger.info("Workday: Pausing for review approval...")
                await approval_event.wait()

            # Submit / Next button
            next_btn = page.locator("[data-automation-id='bottom-navigation-next-button'], button:has-text('Submit')")
            if await next_btn.count() > 0:
                await next_btn.first.click()

            screenshot_dir = Path("data/screenshots")
            screenshot_dir.mkdir(parents=True, exist_ok=True)
            screenshot_file = screenshot_dir / "workday_submission.png"
            await page.screenshot(path=str(screenshot_file))

            return ApplicationSubmissionResult(
                status="SUBMITTED",
                confirmation_receipt="WORKDAY-CONFIRMED",
                screenshot_path=str(screenshot_file),
                qa_audit_records=qa_records,
            )

        except Exception as e:
            logger.error("Workday submission failed: %s", e)
            return ApplicationSubmissionResult(
                status="FAILED",
                failure_stage="FINAL_SUBMIT",
                failure_reason=str(e),
                qa_audit_records=qa_records,
            )
