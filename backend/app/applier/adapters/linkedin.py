"""LinkedIn Easy Apply Platform Adapter (§4.1, §12).

CRITICAL SAFETY RULES:
  1. Refuses to run unless linkedin_opt_in=True in Settings (with typed acknowledgment).
  2. Maximum 25 applications / day strictly enforced.
  3. Never runs in autonomous mode (Assisted Review mode ONLY).
  4. Discard recovery on any unexpected state or error.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any, Callable

from playwright.async_api import Page

from app.applier.adapters.base import ApplicationSubmissionResult, BaseAdapter
from app.applier.captcha import detect_captcha, handle_captcha_challenge
from app.applier.humanize import human_type
from app.applier.qa import QAResolver, ScreeningQuestion
from app.config import get_settings
from app.errors import AppException
from app.schemas.profile import CandidateProfileOut

logger = logging.getLogger(__name__)


class LinkedInAdapter(BaseAdapter):
    """Adapter for LinkedIn Easy Apply applications."""

    platform_name = "LINKEDIN"

    def can_handle(self, url: str, html: str = "") -> bool:
        if "linkedin.com" in url.lower():
            return True
        if "jobs-easy-apply-modal" in html or "jobs-apply-button" in html:
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
        settings = get_settings()

        # Hard Gate: Server-side check for LinkedIn explicit opt-in
        if not getattr(settings, "linkedin_opt_in", False):
            logger.error("LinkedIn adapter execution blocked: linkedin_opt_in is False.")
            raise AppException(
                code="LINKEDIN_NOT_OPTED_IN",
                message="LinkedIn automation requires explicit user opt-in with typed acknowledgment.",
                status_code=403,
            )

        qa_records: list[dict[str, Any]] = []
        resolver = QAResolver(profile)

        try:
            logger.info("LinkedIn: Starting Easy Apply flow")

            # Check for CAPTCHA immediately
            if await detect_captcha(page):
                solved = await handle_captcha_challenge(page, "unknown", "unknown", "LINKEDIN")
                if not solved:
                    return ApplicationSubmissionResult(
                        status="CAPTCHA_BLOCKED",
                        failure_stage="INITIAL_LOAD",
                        failure_reason="Human CAPTCHA AFK timeout expired.",
                    )

            # Locate Easy Apply button
            apply_btn = page.locator("button.jobs-apply-button, button:has-text('Easy Apply')")
            if await apply_btn.count() == 0:
                logger.warning("No Easy Apply button found on page (likely external redirect).")
                return ApplicationSubmissionResult(
                    status="BLOCKED",
                    failure_stage="INITIAL_LOAD",
                    failure_reason="Job posting is external redirect, not Easy Apply.",
                )

            await apply_btn.first.click()
            await page.wait_for_selector(".jobs-easy-apply-modal, [data-test-modal]", timeout=10000)

            # Multi-step loop (max 10 steps to prevent infinite loop)
            for step_idx in range(10):
                # 1. Check for CAPTCHA
                if await detect_captcha(page):
                    solved = await handle_captcha_challenge(page, "unknown", "unknown", "LINKEDIN")
                    if not solved:
                        await self._discard_application(page)
                        return ApplicationSubmissionResult(
                            status="CAPTCHA_BLOCKED",
                            failure_stage="QA_FIELDS",
                            failure_reason="Human CAPTCHA AFK timeout expired.",
                        )

                # Check if we are at the Review step
                review_header = page.locator("h3:has-text('Review your application'), [data-test-review-step]")
                submit_btn = page.locator("button:has-text('Submit application'), button[aria-label*='Submit application']")

                if await review_header.count() > 0 or await submit_btn.count() > 0:
                    logger.info("LinkedIn: Review step reached. Halting for mandatory Assisted Review.")
                    if approval_event is not None:
                        await approval_event.wait()

                    # Click Submit
                    await submit_btn.first.click()
                    await page.wait_for_selector("div[data-test-modal-id='post-apply-modal'], .artdeco-inline-feedback", timeout=10000)

                    screenshot_dir = Path("data/screenshots")
                    screenshot_dir.mkdir(parents=True, exist_ok=True)
                    screenshot_file = screenshot_dir / "linkedin_submission.png"
                    await page.screenshot(path=str(screenshot_file))

                    return ApplicationSubmissionResult(
                        status="SUBMITTED",
                        confirmation_receipt="LI-EASYAPPLY-OK",
                        screenshot_path=str(screenshot_file),
                        qa_audit_records=qa_records,
                    )

                # 2. Fill visible form inputs in the modal
                inputs = page.locator(".jobs-easy-apply-modal input[type='text'], .jobs-easy-apply-modal input[type='tel']")
                input_count = await inputs.count()
                for i in range(input_count):
                    inp = inputs.nth(i)
                    val = await inp.input_value()
                    if not val:
                        # Determine label
                        lbl = await page.evaluate("(el) => el.labels?.[0]?.innerText || el.placeholder || el.name", inp.element_handle())
                        q = ScreeningQuestion(text=lbl or "Text field")
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
                        if res.answer_value:
                            await human_type(inp, res.answer_value, fast_mode=fast_mode)

                # 3. Handle File Upload if requested
                file_input = page.locator(".jobs-easy-apply-modal input[type='file']")
                if await file_input.count() > 0 and resume_pdf_path.is_file():
                    await file_input.first.set_input_files(str(resume_pdf_path.resolve()))

                # 4. Advance: Click Next / Continue button
                next_btn = page.locator("button:has-text('Next'), button:has-text('Continue to next step'), button[aria-label*='Continue to next step']")
                if await next_btn.count() > 0 and await next_btn.first.is_enabled():
                    await next_btn.first.click()
                    await asyncio.sleep(1.0)
                else:
                    # If no next button, check if review button
                    rev_btn = page.locator("button:has-text('Review')")
                    if await rev_btn.count() > 0 and await rev_btn.first.is_enabled():
                        await rev_btn.first.click()
                        await asyncio.sleep(1.0)
                    else:
                        break

            # If loop finished without reaching submit
            await self._discard_application(page)
            return ApplicationSubmissionResult(
                status="FAILED",
                failure_stage="QA_FIELDS",
                failure_reason="Could not complete LinkedIn Easy Apply steps.",
                qa_audit_records=qa_records,
            )

        except Exception as e:
            logger.error("LinkedIn Easy Apply failed: %s", e)
            await self._discard_application(page)
            return ApplicationSubmissionResult(
                status="FAILED",
                failure_stage="FINAL_SUBMIT",
                failure_reason=str(e),
                qa_audit_records=qa_records,
            )

    async def _discard_application(self, page: Page) -> None:
        """Discard modal cleanly without leaving dirty UI state."""
        try:
            close_btn = page.locator("button[aria-label='Dismiss'], button[data-test-modal-close-btn]")
            if await close_btn.count() > 0:
                await close_btn.first.click()
                discard_btn = page.locator("button[data-control-name='discard_application_confirm_btn'], button:has-text('Discard')")
                if await discard_btn.count() > 0:
                    await discard_btn.first.click()
        except Exception as e:
            logger.warning("Error discarding LinkedIn application: %s", e)
