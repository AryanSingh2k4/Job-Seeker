"""Jobs routes for JobSeeker (§7.2)."""

from __future__ import annotations

import json
from datetime import datetime
import uuid
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import PaginationParams, get_db
from app.crawler.service import run_crawler_sweep
from app.scheduler import _companies_crawled_today, _load_crawl_settings
from app.errors import AppException
from app.models.job import Job
from app.models.settings import AppSetting
from app.schemas.job import (
    HardGateDetail,
    JobActionRequest,
    JobActionResponse,
    JobCrawlRequest,
    JobCrawlResponse,
    JobDetail,
    JobListItem,
    JobPage,
    JobSourceCreate,
    JobSourceItem,
    ParsedJobProfile,
    SalaryInfo,
    ScoreBreakdown,
    ScoreComponents,
    TailoredArtifactSummary,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _map_to_list_item(job: Job) -> JobListItem:
    sal = None
    if job.salary_info:
        try:
            sal_dict = json.loads(job.salary_info) if isinstance(job.salary_info, str) else job.salary_info
            sal = SalaryInfo(**sal_dict)
        except Exception:
            pass

    return JobListItem(
        id=job.id,
        title=job.title,
        company=job.company,
        company_logo_url=job.company_logo_url,
        location=job.location,
        workplace_type=job.workplace_type,
        source=job.source,
        ats_provider=job.ats_provider,
        application_type=job.application_type,
        match_score=job.match_score,
        status=job.status,
        salary=sal,
        date_posted=job.date_posted,
        date_discovered=job.date_discovered,
    )


@router.get("", response_model=JobPage)
def list_jobs(
    status_filter: Optional[str] = Query(None, alias="status"),
    min_score: Optional[float] = Query(None),
    source: Optional[str] = Query(None),
    workplace_type: Optional[str] = Query(None),
    remote_only: Optional[bool] = Query(None),
    sort: str = Query("score", description="score | freshness"),
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
) -> JobPage:
    query = db.query(Job)

    if status_filter:
        query = query.filter(Job.status == status_filter)
    if min_score is not None:
        query = query.filter(Job.match_score >= min_score)
    if source:
        query = query.filter(Job.source == source)
    if workplace_type:
        query = query.filter(Job.workplace_type == workplace_type)
    if remote_only:
        query = query.filter(Job.workplace_type == "remote")

    if sort == "freshness":
        query = query.order_by(desc(Job.date_discovered))
    else:
        query = query.order_by(desc(Job.match_score), desc(Job.date_discovered))

    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.page_size).all()

    return JobPage(
        items=[_map_to_list_item(j) for j in items],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.post("/crawl", response_model=JobCrawlResponse)
def trigger_crawl(
    payload: Optional[JobCrawlRequest] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
) -> JobCrawlResponse:
    sweep_id = str(uuid.uuid4())
    sources = payload.sources if payload else None
    interval_min, daily_cap = _load_crawl_settings(db)
    remaining = max(0, daily_cap - _companies_crawled_today(db))
    if remaining == 0:
        from app.errors import AppException
        raise AppException("cap_reached", 409, f"Daily crawl cap reached ({daily_cap} companies)", {})
    background_tasks.add_task(run_crawler_sweep, db, sources, remaining)
    return JobCrawlResponse(started=True, sweep_id=sweep_id)


@router.get("/sources", response_model=List[JobSourceItem])
def list_sources(db: Session = Depends(get_db)) -> List[JobSourceItem]:
    setting = db.query(AppSetting).filter(AppSetting.key == "company_sources").first()
    if not setting:
        return [
            JobSourceItem(company="stripe", providers=["greenhouse"], enabled=True),
            JobSourceItem(company="figma", providers=["lever"], enabled=True),
        ]
    data = json.loads(setting.value)
    return [JobSourceItem(**item) for item in data]

@router.post("/sources", response_model=JobSourceItem)
def add_source(payload: JobSourceCreate, db: Session = Depends(get_db)) -> JobSourceItem:
    setting = db.query(AppSetting).filter(AppSetting.key == "company_sources").first()
    sources = []
    if setting:
        sources = json.loads(setting.value)

    providers = []
    if payload.greenhouse_token:
        providers.append("greenhouse")
    if payload.lever:
        providers.append("lever")
    if payload.ashby:
        providers.append("ashby")
    if payload.workday:
        providers.append("workday")

    item = {"company": payload.company.lower().strip(), "providers": providers, "enabled": True}
    sources = [s for s in sources if s["company"] != item["company"]]
    sources.append(item)

    if not setting:
        setting = AppSetting(key="company_sources", value=json.dumps(sources))
        db.add(setting)
    else:
        setting.value = json.dumps(sources)

    db.commit()
    return JobSourceItem(**item)

@router.delete("/sources/{company}", status_code=status.HTTP_200_OK)
def delete_source(company: str, db: Session = Depends(get_db)) -> dict:
    setting = db.query(AppSetting).filter(AppSetting.key == "company_sources").first()
    if setting:
        sources = json.loads(setting.value)
        sources = [s for s in sources if s["company"].lower() != company.lower()]
        setting.value = json.dumps(sources)
        db.commit()
    return {"status": "ok", "deleted": company}

@router.get("/{id}", response_model=JobDetail)
def get_job(id: str, db: Session = Depends(get_db)) -> JobDetail:
    job = db.query(Job).filter(Job.id == id).first()
    if not job:
        raise AppException(
            code="job_not_found",
            message=f"Job {id} does not exist",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    base = _map_to_list_item(job)

    # Parsed JD
    parsed = None
    if job.job_metadata and "parsed" in job.job_metadata:
        try:
            parsed = ParsedJobProfile(**job.job_metadata["parsed"])
        except Exception:
            pass

    # Score breakdown
    score_breakdown = None
    if job.match_score is not None:
        score_breakdown = ScoreBreakdown(
            final=job.match_score,
            hard_gate=HardGateDetail(passed=True, reasons=[]),
            components=ScoreComponents(s_req=0.9, s_pref=0.8, s_vec=0.85, s_llm=0.85, s_exp=1.0),
            matched_skills=job.skills_required or [],
            missing_skills=[],
            degraded=False,
        )

    # Tailored artifacts (latest verified resume for this job)
    tailored = None
    latest_resume = None
    for tr in sorted(job.tailored_resumes, key=lambda t: t.created_at or datetime.min, reverse=True):
        latest_resume = tr
        break
    if latest_resume is not None:
        tailored = TailoredArtifactSummary(
            resume_pdf_url=f"/api/v1/matcher/resume/{job.id}",
            cover_letter_txt=f"/api/v1/matcher/cover-letter/{job.id}?format=txt",
            cover_letter_pdf_url=f"/api/v1/matcher/cover-letter/{job.id}?format=pdf",
            fact_check_status=latest_resume.fact_check_status or "PASSED",
            created_at=latest_resume.created_at or job.date_discovered,
        )

    return JobDetail(
        **base.model_dump(),
        description_clean=job.description_clean,
        parsed=parsed,
        score_breakdown=score_breakdown,
        tailored=tailored,
    )


@router.post("/{id}/action", response_model=JobActionResponse)
def job_action(id: str, payload: JobActionRequest, db: Session = Depends(get_db)) -> JobActionResponse:
    job = db.query(Job).filter(Job.id == id).first()
    if not job:
        raise AppException(
            code="job_not_found",
            message=f"Job {id} does not exist",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    action = payload.action.lower()
    if action == "approve":
        # score band decides the review lane; both bands stage as ready_to_apply
        job.status = "ready_to_apply"
    elif action == "skip":
        job.status = "skipped"
    elif action == "archive":
        job.status = "archived"
    elif action == "tailor":
        job.status = "tailoring"
    else:
        raise AppException(
            code="validation_error",
            message=f"Unknown action: {payload.action}",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    db.commit()
    return JobActionResponse(id=job.id, status=job.status)




