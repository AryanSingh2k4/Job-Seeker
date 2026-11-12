"""Lever ATS Platform Adapter (§4.3, §12)."""

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


class LeverAdapter(BaseAdapter):
    """Adapter for Lever ATS job applications."""

    platform_name = "LEVER"

    def can_handle(self, url: str, html: str = "") -> bool:
        if "lever.co" in url.lower():
            return True
        if 'id="application-form"' in html:
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
            logger.info("Lever: Locating form fields")
            await page.wait_for_selector("#application-form, form[action*='lever']", timeout=10000)

            # Name / Email / Phone / Org
            name_input = page.locator("input[name='name']")
            if await name_input.count() > 0:
                await human_type(name_input, profile.full_name, fast_mode=fast_mode)

            email_input = page.locator("input[name='email']")
            if await email_input.count() > 0:
                await human_type(email_input, profile.email, fast_mode=fast_mode)

            phone_input = page.locator("input[name='phone']")
            if await phone_input.count() > 0:
                await human_type(phone_input, profile.phone, fast_mode=fast_mode)

            # Socials
            li_input = page.locator("input[name='urls[LinkedIn]']")
            if await li_input.count() > 0 and profile.linkedin_url:
                await human_type(li_input, profile.linkedin_url, fast_mode=fast_mode)

            gh_input = page.locator("input[name='urls[GitHub]']")
            if await gh_input.count() > 0 and profile.github_url:
                await human_type(gh_input, profile.github_url, fast_mode=fast_mode)

            # Resume upload
            if resume_pdf_path and resume_pdf_path.is_file():
                file_input = page.locator("input[name='resume'], input[type='file']")
                if await file_input.count() > 0:
                    await file_input.first.set_input_files(str(resume_pdf_path.resolve()))

            # Additional cards / questions
            cards = page.locator(".application-additional, .custom-question")
            count = await cards.count()
            for i in range(count):
                c_elem = cards.nth(i)
                label_elem = c_elem.locator(".text, label").first
                if await label_elem.count() == 0:
                    continue
                q_text = await label_elem.inner_text()
                q = ScreeningQuestion(text=q_text)
                res = await resolver.resolve(q)
                qa_records.append({
                    "question_text": q.text,
                    "answer_value": res.answer_value,
                    "resolution_tier": res.resolution_tier,
                    "confidence_score": res.confidence_score,
                    "user_verified": res.user_verified,
                })
                if on_qa_answered:
                    on_qa_answered(qa_records[-1])

                inp = c_elem.locator("input[type='text'], textarea")
                if await inp.count() > 0:
                    await human_type(inp.first, res.answer_value, fast_mode=fast_mode)

            # Assisted Review Pause
            if submission_mode == "ASSISTED_REVIEW" and approval_event is not None:
                logger.info("Lever: Pausing for review approval...")
                await approval_event.wait()

            # Submit button
            submit_btn = page.locator("#btn-submit, button[type='submit']")
            if await submit_btn.count() > 0:
                await submit_btn.first.click()

            # Screenshot
            screenshot_dir = Path("data/screenshots")
            screenshot_dir.mkdir(parents=True, exist_ok=True)
            screenshot_file = screenshot_dir / "lever_submission.png"
            await page.screenshot(path=str(screenshot_file))

            return ApplicationSubmissionResult(
                status="SUBMITTED",
                confirmation_receipt="LEVER-CONFIRMED",
                screenshot_path=str(screenshot_file),
                qa_audit_records=qa_records,
            )

        except Exception as e:
            logger.error("Lever submission failed: %s", e)
            return ApplicationSubmissionResult(
                status="FAILED",
                failure_stage="FINAL_SUBMIT",
                failure_reason=str(e),
                qa_audit_records=qa_records,
            )
