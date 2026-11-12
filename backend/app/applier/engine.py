"""Application Orchestration Engine & State Machine (§7, §8, §12).

Manages state machine:
  QUEUED -> STARTING -> AUTOFILLING -> PAUSED_FOR_REVIEW -> SUBMITTED
  or FAILED, BLOCKED, CAPTCHA_BLOCKED, DISCARDED.
Enforces:
  Daily application caps (LinkedIn <= 25, ATS <= 40).
  14-day company cooldown.
  Working window (08:30-18:30 local).
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, time, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.applier.adapters import get_adapter_for_url
from app.applier.adapters.base import ApplicationSubmissionResult
from app.applier.runtime import get_browser_manager
from app.config import get_settings
from app.db import SessionLocal
from app.errors import AppException
from app.models.application import Application, QAAnswerAudit
from app.models.candidate import CandidateProfile
from app.models.job import Job
from app.schemas.profile import CandidateProfileOut
from app.ws.telemetry import telemetry_hub

logger = logging.getLogger(__name__)

# In-memory registry of approval events for paused applications
_APPROVAL_EVENTS: dict[str, asyncio.Event] = {}


def get_approval_event(application_id: str) -> asyncio.Event:
    if application_id not in _APPROVAL_EVENTS:
        _APPROVAL_EVENTS[application_id] = asyncio.Event()
    return _APPROVAL_EVENTS[application_id]


def approve_application(application_id: str) -> bool:
    """Approve a paused application review run."""
    ev = _APPROVAL_EVENTS.get(application_id)
    if ev:
        ev.set()
        return True
    return False


def is_within_working_hours() -> bool:
    """Check if current local time is within 08:30 to 18:30."""
    if os.getenv("AUTOJOB_TEST_MODE", "").lower() in ("1", "true", "yes"):
        return True
    now_local = datetime.now().time()
    start = time(8, 30)
    end = time(18, 30)
    return start <= now_local <= end


class ApplicationEngine:
    """Orchestrates single-application runs with atomic gate checks."""

    def __init__(self, db: Session | None = None) -> None:
        self.db = db or SessionLocal()
        self._owns_session = db is None

    def close(self) -> None:
        if self._owns_session:
            self.db.close()

    def check_safety_gates(self, job: Job, platform: str, override_working_hours: bool = False) -> None:
        """Atomically enforce caps, cooldown, and working hours."""
        settings = get_settings()

        # 1. Working hours check
        if not override_working_hours and not is_within_working_hours():
            raise AppException(
                code="OUTSIDE_WORKING_HOURS",
                message="Automated submissions only run during working hours (08:30-18:30 local).",
                status_code=400,
            )

        # 2. Daily caps check
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        daily_count = self.db.execute(
            select(func.count(Application.id)).where(
                Application.started_at >= today_start,
                Application.status.in_(["SUBMITTED", "APPLIED", "PAUSED_FOR_REVIEW"]),
            )
        ).scalar() or 0

        if daily_count >= settings.daily_app_limit:
            raise AppException(
                code="DAILY_CAP_REACHED",
                message=f"Daily application cap of {settings.daily_app_limit} reached.",
                status_code=400,
            )

        if platform == "LINKEDIN":
            li_count = self.db.execute(
                select(func.count(Application.id)).where(
                    Application.platform == "LINKEDIN",
                    Application.started_at >= today_start,
                    Application.status.in_(["SUBMITTED", "APPLIED", "PAUSED_FOR_REVIEW"]),
                )
            ).scalar() or 0
            if li_count >= 25:
                raise AppException(
                    code="LINKEDIN_CAP_REACHED",
                    message="LinkedIn daily safety limit of 25 reached.",
                    status_code=400,
                )
        else:
            ats_count = self.db.execute(
                select(func.count(Application.id)).where(
                    Application.platform != "LINKEDIN",
                    Application.started_at >= today_start,
                    Application.status.in_(["SUBMITTED", "APPLIED", "PAUSED_FOR_REVIEW"]),
                )
            ).scalar() or 0
            if ats_count >= 40:
                raise AppException(
                    code="ATS_CAP_REACHED",
                    message="ATS daily safety limit of 40 reached.",
                    status_code=400,
                )

        # 3. 14-day company cooldown
        fourteen_days_ago = datetime.now(timezone.utc) - datetime.timedelta(days=14) if hasattr(datetime, "timedelta") else datetime.now(timezone.utc)
        # Using timedelta directly
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=14)

        recent_app = self.db.execute(
            select(Application.id).join(Job, Application.job_id == Job.id).where(
                Job.company == job.company,
                Application.started_at >= cutoff,
                Application.status == "SUBMITTED",
            )
        ).first()
        if recent_app:
            raise AppException(
                code="COOLDOWN_ACTIVE",
                message=f"14-day company cooldown active for {job.company}.",
                status_code=400,
            )

    async def execute_application(
        self,
        application_id: str,
        override_working_hours: bool = False,
        fast_mode: bool = False,
    ) -> ApplicationSubmissionResult:
        """Run the end-to-end automation for an application."""
        app_record = self.db.query(Application).filter(Application.id == application_id).first()
        if not app_record:
            raise AppException(code="APPLICATION_NOT_FOUND", message="Application record not found", status_code=404)

        job = self.db.query(Job).filter(Job.id == app_record.job_id).first()
        if not job:
            raise AppException(code="JOB_NOT_FOUND", message="Job not found", status_code=404)

        # Load profile
        profile_db = self.db.query(CandidateProfile).first()
        if not profile_db:
            raise AppException(code="PROFILE_NOT_CONFIGURED", message="Candidate profile not configured", status_code=400)
        profile_out = CandidateProfileOut.model_validate(profile_db)

        # Enforce safety gates
        self.check_safety_gates(job, app_record.platform, override_working_hours=override_working_hours)

        start_time = datetime.now(timezone.utc)
        app_record.status = "STARTING"
        job.status = "applying"
        self.db.commit()

        await telemetry_hub.broadcast({
            "event": "APPLICATION_STATUS_CHANGED",
            "application_id": app_record.id,
            "job_id": job.id,
            "status": "STARTING",
            "stage": "INITIAL_LOAD",
        })

        browser_manager = get_browser_manager()
        page = None
        try:
            page = await browser_manager.new_page()
            app_url = job.application_url or job.job_url or "http://localhost:8000/mock_ats/index.html"
            logger.info("ApplicationEngine: Navigating to %s", app_url)
            await page.goto(app_url, timeout=30000)

            app_record.status = "AUTOFILLING"
            self.db.commit()
            await telemetry_hub.broadcast({
                "event": "APPLICATION_STATUS_CHANGED",
                "application_id": app_record.id,
                "job_id": job.id,
                "status": "AUTOFILLING",
                "stage": "CONTACT_FIELDS",
            })

            # Select adapter
            html_content = await page.content()
            adapter = get_adapter_for_url(app_url, html_content)
            logger.info("Using adapter: %s for %s", adapter.platform_name, app_url)

            # Autonomous Mode Gate (§7.2)
            # Requires: non-LinkedIn ATS + score >= 95 + explicit opt-in + 100% deterministic QA
            effective_mode = "ASSISTED_REVIEW"
            if (
                app_record.submission_mode == "AUTONOMOUS"
                and getattr(settings, "autonomous_opt_in", False)
                and adapter.platform_name != "LINKEDIN"
                and (job.match_score or 0) >= 95
            ):
                effective_mode = "AUTONOMOUS"
                logger.info("Application %s qualified for AUTONOMOUS submission mode.", app_record.id)
            else:
                effective_mode = "ASSISTED_REVIEW"

            # Tailored resume path
            resume_path = Path("data/resumes/default.pdf")
            if app_record.tailored_resume_id:
                # Can locate specific tailored resume artifact if needed
                pass

            approval_event = get_approval_event(app_record.id) if effective_mode == "ASSISTED_REVIEW" else None

            # Callback for QA answering telemetry + autonomous safety check
            def on_qa(qa_data: dict[str, Any]) -> None:
                nonlocal effective_mode, approval_event
                # Autonomous mode requires 100% deterministic answers with 1.0 confidence
                if effective_mode == "AUTONOMOUS":
                    if qa_data.get("resolution_tier") != "DETERMINISTIC" or qa_data.get("confidence_score", 0.0) < 1.0:
                        logger.warning("Downgrading to ASSISTED_REVIEW: non-deterministic QA answer encountered.")
                        effective_mode = "ASSISTED_REVIEW"
                        approval_event = get_approval_event(app_record.id)

                asyncio.create_task(
                    telemetry_hub.broadcast({
                        "event": "QA_ANSWERED",
                        "application_id": app_record.id,
                        "question": qa_data["question_text"],
                        "answer": qa_data["answer_value"],
                        "tier": qa_data["resolution_tier"],
                        "confidence": qa_data["confidence_score"],
                    })
                )

            # If Assisted Review, prepare HITL notification task when review step is reached
            if app_record.submission_mode == "ASSISTED_REVIEW":
                async def notify_hitl_pause() -> None:
                    # Polling page to see if review step is reached
                    for _ in range(60):
                        await asyncio.sleep(0.5)
                        if await page.locator("#step-review, .review-step, [data-test='step-review']").count() > 0:
                            app_record.status = "PAUSED_FOR_REVIEW"
                            self.db.commit()
                            await telemetry_hub.broadcast({
                                "event": "APPLICATION_STATUS_CHANGED",
                                "application_id": app_record.id,
                                "job_id": job.id,
                                "status": "PAUSED_FOR_REVIEW",
                                "stage": "REVIEW_STEP",
                            })
                            await telemetry_hub.broadcast({
                                "event": "HITL_REVIEW_REQUIRED",
                                "application_id": app_record.id,
                                "job_id": job.id,
                                "company": job.company,
                                "title": job.title,
                            })
                            break
                asyncio.create_task(notify_hitl_pause())

            result = await adapter.fill_and_submit(
                page=page,
                profile=profile_out,
                resume_pdf_path=resume_path,
                cover_letter=None,
                submission_mode=app_record.submission_mode,
                approval_event=approval_event,
                on_qa_answered=on_qa,
                fast_mode=fast_mode,
            )

            # Update DB with result
            end_time = datetime.now(timezone.utc)
            duration = int((end_time - start_time).total_seconds())

            app_record.status = result.status
            app_record.completed_at = end_time if result.status in ("SUBMITTED", "FAILED", "DISCARDED") else None
            app_record.duration_seconds = duration
            app_record.confirmation_receipt = result.confirmation_receipt
            app_record.screenshot_path = result.screenshot_path
            app_record.failure_stage = result.failure_stage
            app_record.failure_reason = result.failure_reason

            if result.status == "SUBMITTED":
                job.status = "applied"
            elif result.status == "FAILED":
                job.status = "failed"

            # Save QA audit records
            for rec in result.qa_audit_records:
                audit = QAAnswerAudit(
                    application_id=app_record.id,
                    question_text=rec["question_text"],
                    answer_value=str(rec["answer_value"]),
                    resolution_tier=rec["resolution_tier"],
                    confidence_score=rec["confidence_score"],
                    user_verified=rec.get("user_verified", False),
                )
                self.db.add(audit)

            self.db.commit()

            await telemetry_hub.broadcast({
                "event": "APPLICATION_STATUS_CHANGED",
                "application_id": app_record.id,
                "job_id": job.id,
                "status": result.status,
                "receipt": result.confirmation_receipt,
            })

            return result

        except Exception as e:
            logger.error("Application execution crashed: %s", e)
            app_record.status = "FAILED"
            app_record.failure_stage = "FINAL_SUBMIT"
            app_record.failure_reason = str(e)
            job.status = "failed"
            self.db.commit()
            return ApplicationSubmissionResult(
                status="FAILED",
                failure_stage="FINAL_SUBMIT",
                failure_reason=str(e),
            )
        finally:
            if page:
                try:
                    await page.close()
                except Exception:
                    pass
