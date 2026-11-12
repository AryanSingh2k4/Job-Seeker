"""Greenhouse ATS Platform Adapter (§4.2, §12)."""

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


class GreenhouseAdapter(BaseAdapter):
    """Adapter for Greenhouse board and embedded application pages."""

    platform_name = "GREENHOUSE"

    def can_handle(self, url: str, html: str = "") -> bool:
        if "greenhouse.io" in url.lower() or "gh_jid" in url.lower():
            return True
        if 'id="application_form"' in html or 'data-qa="greenhouse"' in html:
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
            logger.info("Greenhouse: Locating form fields")
            # Wait for either #first_name or input[id*=first_name]
            await page.wait_for_selector("#first_name, input[name='first_name']", timeout=10000)

            # Fill Standard Contact Fields
            if await page.locator("#first_name").count() > 0:
                await human_type(page.locator("#first_name"), profile.first_name, fast_mode=fast_mode)
            if await page.locator("#last_name").count() > 0:
                await human_type(page.locator("#last_name"), profile.last_name, fast_mode=fast_mode)
            if await page.locator("#email").count() > 0:
                await human_type(page.locator("#email"), profile.email, fast_mode=fast_mode)
            if await page.locator("#phone").count() > 0:
                await human_type(page.locator("#phone"), profile.phone, fast_mode=fast_mode)

            # Resume upload
            if resume_pdf_path and resume_pdf_path.is_file():
                file_input = page.locator("input[type='file'][id*='resume'], input[type='file']")
                if await file_input.count() > 0:
                    await file_input.first.set_input_files(str(resume_pdf_path.resolve()))

            # Cover letter
            if cover_letter:
                cl_input = page.locator("#cover_letter, textarea[id*='cover_letter']")
                if await cl_input.count() > 0:
                    await human_type(cl_input.first, cover_letter, fast_mode=fast_mode)

            # Custom questions in .field containers
            fields = page.locator(".field:has(input, select, textarea)")
            count = await fields.count()
            for i in range(count):
                f_elem = fields.nth(i)
                label_elem = f_elem.locator("label").first
                if await label_elem.count() == 0:
                    continue
                label_text = await label_elem.inner_text()
                # Skip already filled standard fields
                if any(x in label_text.lower() for x in ("first name", "last name", "email", "phone", "resume", "cover letter")):
                    continue

                q = ScreeningQuestion(text=label_text)
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

                # Fill input or select if found
                sel = f_elem.locator("select")
                inp = f_elem.locator("input[type='text']")
                if await sel.count() > 0:
                    try:
                        await sel.select_option(label=res.answer_value)
                    except Exception:
                        pass
                elif await inp.count() > 0:
                    await human_type(inp, res.answer_value, fast_mode=fast_mode)

            # Assisted Review Pause
            if submission_mode == "ASSISTED_REVIEW" and approval_event is not None:
                logger.info("Greenhouse: Pausing for review approval...")
                await approval_event.wait()

            # Submit
            submit_btn = page.locator("#submit_app, button[type='submit']")
            if await submit_btn.count() > 0:
                await submit_btn.first.click()

            # Screenshot
            screenshot_dir = Path("data/screenshots")
            screenshot_dir.mkdir(parents=True, exist_ok=True)
            screenshot_file = screenshot_dir / "greenhouse_submission.png"
            await page.screenshot(path=str(screenshot_file))

            return ApplicationSubmissionResult(
                status="SUBMITTED",
                confirmation_receipt="GH-CONFIRMED",
                screenshot_path=str(screenshot_file),
                qa_audit_records=qa_records,
            )

        except Exception as e:
            logger.error("Greenhouse submission failed: %s", e)
            return ApplicationSubmissionResult(
                status="FAILED",
                failure_stage="FINAL_SUBMIT",
                failure_reason=str(e),
                qa_audit_records=qa_records,
            )
