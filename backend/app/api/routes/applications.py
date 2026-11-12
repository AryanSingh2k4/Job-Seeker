"""Applications routes for JobSeeker (§7.4)."""

from __future__ import annotations

import os
import uuid
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response, status
from fastapi.responses import FileResponse
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.deps import PaginationParams, get_db
from app.applier.engine import ApplicationEngine, approve_application as set_approval
from app.errors import AppException
from app.models.application import Application, AuditLog, QAAnswerAudit
from app.models.job import Job
from app.schemas.application import (
    ApplicationActionResponse,
    ApplicationDetail,
    ApplicationListItem,
    ApplicationPage,
    ApplicationStartResponse,
    ApplicationStats,
    AuditLogItem,
    QAAnswerAuditItem,
)

router = APIRouter(prefix="/applications", tags=["applications"])


def _map_app_list_item(app: Application, job: Optional[Job] = None) -> ApplicationListItem:
    company = job.company if job else "Unknown Company"
    title = job.title if job else "Unknown Role"
    screenshot_url = f"/api/v1/applications/{app.id}/screenshot" if app.screenshot_path else None

    return ApplicationListItem(
        id=app.id,
        job_id=app.job_id,
        company=company,
        title=title,
        platform=app.platform,
        submission_mode=app.submission_mode or "ASSISTED_REVIEW",
        status=app.status,
        started_at=app.started_at,
        completed_at=app.completed_at,
        duration_seconds=app.duration_seconds or 0,
        confirmation_receipt=app.confirmation_receipt,
        screenshot_path=screenshot_url,
        failure_stage=app.failure_stage,
        failure_reason=app.failure_reason,
    )


@router.get("", response_model=ApplicationPage)
def list_applications(
    status_filter: Optional[str] = Query(None, alias="status"),
    platform: Optional[str] = Query(None),
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
) -> ApplicationPage:
    query = db.query(Application)
    if status_filter:
        query = query.filter(Application.status == status_filter)
    if platform:
        query = query.filter(Application.platform == platform.upper())

    query = query.order_by(desc(Application.started_at))
    total = query.count()
    apps = query.offset(pagination.offset).limit(pagination.page_size).all()

    # Pre-fetch jobs
    job_ids = [a.job_id for a in apps]
    jobs = {j.id: j for j in db.query(Job).filter(Job.id.in_(job_ids)).all()} if job_ids else {}

    items = [_map_app_list_item(a, jobs.get(a.job_id)) for a in apps]
    return ApplicationPage(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/stats", response_model=ApplicationStats)
def get_application_stats(db: Session = Depends(get_db)) -> ApplicationStats:
    from sqlalchemy import func
    total = db.query(func.count(Application.id)).scalar() or 0
    submitted = db.query(func.count(Application.id)).filter(Application.status.in_(["SUBMITTED", "APPLIED"])).scalar() or 0
    failed = db.query(func.count(Application.id)).filter(Application.status == "FAILED").scalar() or 0
    paused = db.query(func.count(Application.id)).filter(Application.status == "PAUSED_FOR_REVIEW").scalar() or 0
    blocked = db.query(func.count(Application.id)).filter(Application.status.in_(["BLOCKED", "CAPTCHA_BLOCKED"])).scalar() or 0

    platform_counts = db.query(Application.platform, func.count(Application.id)).group_by(Application.platform).all()
    by_plat = {p: count for p, count in platform_counts}

    avg_duration = db.query(func.avg(Application.duration_seconds)).filter(Application.duration_seconds > 0).scalar() or 0.0

    return ApplicationStats(
        total_applications=total,
        submitted_count=submitted,
        failed_count=failed,
        paused_count=paused,
        blocked_count=blocked,
        by_platform=by_plat,
        average_duration_seconds=float(avg_duration),
    )


@router.get("/export")
def export_applications_csv(db: Session = Depends(get_db)) -> Response:
    import csv
    import io
    apps = db.query(Application).order_by(desc(Application.started_at)).all()
    job_ids = [a.job_id for a in apps]
    jobs = {j.id: j for j in db.query(Job).filter(Job.id.in_(job_ids)).all()} if job_ids else {}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "job_id", "company", "title", "platform", "submission_mode",
        "status", "started_at", "completed_at", "duration_seconds",
        "confirmation_receipt", "failure_stage", "failure_reason",
    ])

    for a in apps:
        job = jobs.get(a.job_id)
        writer.writerow([
            a.id,
            a.job_id,
            job.company if job else "",
            job.title if job else "",
            a.platform,
            a.submission_mode,
            a.status,
            a.started_at.isoformat() if a.started_at else "",
            a.completed_at.isoformat() if a.completed_at else "",
            a.duration_seconds or 0,
            a.confirmation_receipt or "",
            a.failure_stage or "",
            a.failure_reason or "",
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="applications.csv"'},
    )


@router.get("/{id}", response_model=ApplicationDetail)
def get_application(id: str, db: Session = Depends(get_db)) -> ApplicationDetail:
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise AppException(
            code="application_not_found",
            message=f"Application {id} does not exist",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    job = db.query(Job).filter(Job.id == app.job_id).first()
    base = _map_app_list_item(app, job)

    qa_rows = db.query(QAAnswerAudit).filter(QAAnswerAudit.application_id == id).all()
    qa_answers = [
        QAAnswerAuditItem(
            id=q.id,
            question_text=q.question_text,
            answer_value=q.answer_value,
            resolution_tier=q.resolution_tier,
            confidence_score=q.confidence_score,
            user_verified=q.user_verified,
            timestamp=q.timestamp,
        )
        for q in qa_rows
    ]

    events_rows = (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == "application", AuditLog.entity_id == id)
        .order_by(AuditLog.timestamp)
        .all()
    )
    events = [
        AuditLogItem(
            id=e.id,
            entity_type=e.entity_type,
            entity_id=e.entity_id,
            event_type=e.event_type,
            severity=e.severity,
            message=e.message,
            details=e.details or {},
            timestamp=e.timestamp,
        )
        for e in events_rows
    ]

    return ApplicationDetail(
        **base.model_dump(),
        qa_answers=qa_answers,
        events=events,
    )


@router.get("/{id}/screenshot")
def get_application_screenshot(id: str, db: Session = Depends(get_db)) -> Response:
    app = db.query(Application).filter(Application.id == id).first()
    if not app or not app.screenshot_path or not os.path.isfile(app.screenshot_path):
        # 1x1 transparent png
        transparent_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
        return Response(content=transparent_png, media_type="image/png")

    return FileResponse(app.screenshot_path, media_type="image/png")


@router.post("/start/{job_id}", response_model=ApplicationStartResponse)
def start_application(
    job_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> ApplicationStartResponse:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise AppException(
            code="job_not_found",
            message=f"Job {job_id} does not exist",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    app_id = str(uuid.uuid4())
    app = Application(
        id=app_id,
        job_id=job_id,
        platform=job.ats_provider.upper() if job.ats_provider else "GREENHOUSE",
        submission_mode="ASSISTED_REVIEW",
        status="QUEUED",
    )
    db.add(app)
    db.commit()

    async def _run() -> None:
        engine = ApplicationEngine()
        try:
            await engine.execute_application(app_id)
        except Exception:
            pass
        finally:
            engine.close()

    background_tasks.add_task(_run)
    return ApplicationStartResponse(application_id=app_id, status="QUEUED")


@router.post("/approve/{id}", response_model=ApplicationActionResponse)
def approve_application(id: str, db: Session = Depends(get_db)) -> ApplicationActionResponse:
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise AppException(
            code="application_not_found",
            message=f"Application {id} does not exist",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    set_approval(id)
    app.status = "SUBMITTED"
    db.commit()
    return ApplicationActionResponse(status="SUBMITTED")


@router.post("/abort/{id}", response_model=ApplicationActionResponse)
def abort_application(id: str, db: Session = Depends(get_db)) -> ApplicationActionResponse:
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise AppException(
            code="application_not_found",
            message=f"Application {id} does not exist",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    app.status = "DISCARDED"
    db.commit()
    return ApplicationActionResponse(status="DISCARDED")
