"""Mock ATS Platform Adapter (§4, §9, §12).

Automates the local synthetic mock ATS fixture (backend/fixtures/mock_ats/index.html)
with full contact, screening questions, dropzone resume upload, review pause, and submit.
"""

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


class MockATSAdapter(BaseAdapter):
    """Adapter for the synthetic in-repo Mock ATS."""

    platform_name = "MOCK_ATS"

    def can_handle(self, url: str, html: str = "") -> bool:
        if "mock_ats" in url.lower():
            return True
        if 'data-platform="mock_ats"' in html:
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

        # -------------------------------------------------------------
        # Step 1: Contact Information & File Upload
        # -------------------------------------------------------------
        try:
            logger.info("MockATS: Filling Step 1 - Contact Information")
            await page.wait_for_selector("#step-contact", state="visible", timeout=10000)

            parts = profile.full_name.split()
            first_name = getattr(profile, "first_name", parts[0] if parts else "Ada")
            last_name = getattr(profile, "last_name", parts[-1] if len(parts) > 1 else "Lovelace")
            loc = getattr(profile, "location", None) or f"{getattr(profile, 'city', 'London')}, {getattr(profile, 'state', 'UK')}".strip(", ")

            await human_type(page.locator("#first_name"), first_name, fast_mode=fast_mode)
            await human_type(page.locator("#last_name"), last_name, fast_mode=fast_mode)
            await human_type(page.locator("#email"), profile.email, fast_mode=fast_mode)
            await human_type(page.locator("#phone"), profile.phone, fast_mode=fast_mode)
            if loc:
                await human_type(page.locator("#location"), loc, fast_mode=fast_mode)
            if profile.linkedin_url:
                await human_type(page.locator("#linkedin_url"), profile.linkedin_url, fast_mode=fast_mode)

            # Upload resume via file input
            if resume_pdf_path and resume_pdf_path.is_file():
                logger.info("MockATS: Uploading resume from %s", resume_pdf_path)
                resume_input = page.locator("#resume")
                await resume_input.set_input_files(str(resume_pdf_path.resolve()))
                # Verify dropzone received file name
                await page.wait_for_selector("#resume-name:not(:empty)", timeout=5000)

            # Cover letter
            if cover_letter:
                await human_type(page.locator("#cover_letter"), cover_letter, fast_mode=fast_mode)

            # Advance to Step 2
            await page.locator('#step-contact button[data-test="next"]').click()
        except Exception as e:
            logger.error("MockATS failure at CONTACT_FIELDS: %s", e)
            return ApplicationSubmissionResult(
                status="FAILED",
                failure_stage="CONTACT_FIELDS",
                failure_reason=str(e),
                qa_audit_records=qa_records,
            )

        # -------------------------------------------------------------
        # Step 2: Screening Questions
        # -------------------------------------------------------------
        try:
            logger.info("MockATS: Filling Step 2 - Screening Questions")
            await page.wait_for_selector("#step-screening", state="visible", timeout=10000)

            # 1. Work Authorization (select)
            q_auth = ScreeningQuestion(
                text="Are you legally authorized to work in the United States?",
                field_type="select",
                field_id="work_authorization",
                options=["us_citizen", "us_permanent_resident", "us_work_visa", "require_sponsorship", "other"],
            )
            res_auth = await resolver.resolve(q_auth)
            qa_records.append({
                "question_text": q_auth.text,
                "answer_value": res_auth.answer_value,
                "resolution_tier": res_auth.resolution_tier,
                "confidence_score": res_auth.confidence_score,
                "user_verified": res_auth.user_verified,
            })
            if on_qa_answered:
                on_qa_answered(qa_records[-1])
            await page.select_option("#work_authorization", res_auth.answer_value)

            # 2. Requires Sponsorship (radio)
            q_spon = ScreeningQuestion(
                text="Will you now or in the future require sponsorship?",
                field_type="radio",
                name="requires_sponsorship",
                options=["yes", "no"],
            )
            res_spon = await resolver.resolve(q_spon)
            qa_records.append({
                "question_text": q_spon.text,
                "answer_value": res_spon.answer_value,
                "resolution_tier": res_spon.resolution_tier,
                "confidence_score": res_spon.confidence_score,
                "user_verified": res_spon.user_verified,
            })
            if on_qa_answered:
                on_qa_answered(qa_records[-1])
            if res_spon.answer_value.lower() == "yes":
                await page.locator('input[name="requires_sponsorship"][value="yes"]').check()
            else:
                await page.locator('input[name="requires_sponsorship"][value="no"]').check()

            # 3. Years of Python experience (number)
            q_py = ScreeningQuestion(
                text="Years of professional Python experience",
                field_type="number",
                field_id="years_python",
            )
            res_py = await resolver.resolve(q_py)
            qa_records.append({
                "question_text": q_py.text,
                "answer_value": res_py.answer_value,
                "resolution_tier": res_py.resolution_tier,
                "confidence_score": res_py.confidence_score,
                "user_verified": res_py.user_verified,
            })
            if on_qa_answered:
                on_qa_answered(qa_records[-1])
            await human_type(page.locator("#years_python"), res_py.answer_value or "5", fast_mode=fast_mode)

            # 4. Willing to relocate (radio)
            q_reloc = ScreeningQuestion(
                text="Are you willing to relocate?",
                field_type="radio",
                name="willing_to_relocate",
                options=["yes", "no"],
            )
            res_reloc = await resolver.resolve(q_reloc)
            qa_records.append({
                "question_text": q_reloc.text,
                "answer_value": res_reloc.answer_value,
                "resolution_tier": res_reloc.resolution_tier,
                "confidence_score": res_reloc.confidence_score,
                "user_verified": res_reloc.user_verified,
            })
            if on_qa_answered:
                on_qa_answered(qa_records[-1])
            if res_reloc.answer_value.lower() == "yes":
                await page.locator('input[name="willing_to_relocate"][value="yes"]').check()
            else:
                await page.locator('input[name="willing_to_relocate"][value="no"]').check()

            # 5. How did you hear about us (select)
            q_hear = ScreeningQuestion(
                text="How did you hear about us?",
                field_type="select",
                field_id="hear_about_us",
                options=["LinkedIn", "Company website", "Referral", "Job board", "Other"],
            )
            res_hear = await resolver.resolve(q_hear)
            qa_records.append({
                "question_text": q_hear.text,
                "answer_value": res_hear.answer_value,
                "resolution_tier": res_hear.resolution_tier,
                "confidence_score": res_hear.confidence_score,
                "user_verified": res_hear.user_verified,
            })
            if on_qa_answered:
                on_qa_answered(qa_records[-1])
            await page.select_option("#hear_about_us", res_hear.answer_value)

            # 6. Project story (textarea)
            project_story = "Designed and scaled high-performance asynchronous distributed microservices."
            await human_type(page.locator("#project_story"), project_story, fast_mode=fast_mode)

            # 7. Consent checkbox
            await page.locator("#consent").check()

            # Advance to Step 3
            await page.locator('#step-screening button[data-test="next"]').click()
        except Exception as e:
            logger.error("MockATS failure at QA_FIELDS: %s", e)
            return ApplicationSubmissionResult(
                status="FAILED",
                failure_stage="QA_FIELDS",
                failure_reason=str(e),
                qa_audit_records=qa_records,
            )

        # -------------------------------------------------------------
        # Step 3: Review & Submit
        # -------------------------------------------------------------
        try:
            logger.info("MockATS: Entering Step 3 - Review")
            await page.wait_for_selector("#step-review", state="visible", timeout=10000)

            # If in Assisted Mode, PAUSE for user review / approval
            if submission_mode == "ASSISTED_REVIEW" and approval_event is not None:
                logger.info("MockATS: Assisted Mode active. Pausing for human review...")
                # Caller will transition state to PAUSED_FOR_REVIEW and emit WS event
                await approval_event.wait()
                logger.info("MockATS: Human review approved! Resuming submission...")

            # Check certify checkbox
            await page.locator("#certify").check()

            # Click Submit button
            logger.info("MockATS: Submitting application")
            await page.locator('#step-review button[data-test="submit"]').click()

            # Wait for confirmation screen
            await page.wait_for_selector("#confirmation", state="visible", timeout=10000)

            # Extract confirmation receipt
            receipt_elem = page.locator('[data-test="receipt"]')
            receipt_text = await receipt_elem.inner_text() if await receipt_elem.count() > 0 else "MOCK-RECEIPT-OK"

            # Capture confirmation screenshot
            screenshot_dir = Path("data/screenshots")
            screenshot_dir.mkdir(parents=True, exist_ok=True)
            screenshot_file = screenshot_dir / f"mock_ats_{receipt_text}.png"
            await page.screenshot(path=str(screenshot_file), full_page=True)

            logger.info("MockATS: Successfully submitted! Receipt=%s", receipt_text)
            return ApplicationSubmissionResult(
                status="SUBMITTED",
                confirmation_receipt=receipt_text,
                screenshot_path=str(screenshot_file),
                qa_audit_records=qa_records,
            )
        except Exception as e:
            logger.error("MockATS failure at FINAL_SUBMIT: %s", e)
            return ApplicationSubmissionResult(
                status="FAILED",
                failure_stage="FINAL_SUBMIT",
                failure_reason=str(e),
                qa_audit_records=qa_records,
            )
