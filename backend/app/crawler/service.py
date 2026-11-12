"""Crawler orchestration service for JobSeeker (§6.1)."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy.orm import Session

from app.crawler.models import RawJobPosting
from app.crawler.pipeline.canonicalize import (
    canonicalize_url,
    detect_application_type,
    detect_ats_provider,
)
from app.crawler.pipeline.dedup import check_duplicate
from app.crawler.pipeline.fingerprint import (
    compute_semantic_fingerprint,
    compute_url_fingerprint,
)
from app.crawler.pipeline.prefilter import run_prefilter
from app.crawler.pipeline.sanitize import sanitize_job_description
from app.crawler.registry import get_active_companies
from app.crawler.sources.ashby import fetch_ashby_jobs
from app.crawler.sources.greenhouse import fetch_greenhouse_jobs
from app.crawler.sources.lever import fetch_lever_jobs
from app.models.candidate import CandidateProfile
from app.models.job import Job
from app.ws.telemetry import hub

logger = logging.getLogger(__name__)


async def run_crawler_sweep(db: Session, requested_sources: Optional[List[str]] = None, company_limit: Optional[int] = None) -> Dict[str, Any]:
    """Execute job discovery sweep across configured company ATS boards."""
    sweep_id = str(uuid.uuid4())
    logger.info("Starting crawler sweep %s", sweep_id)

    profile_row = db.query(CandidateProfile).first()
    candidate_profile = None
    if profile_row:
        candidate_profile = {
            "requires_sponsorship": profile_row.requires_sponsorship,
            "target_salary_min": profile_row.target_salary_min,
            "target_preferences": profile_row.target_preferences or {},
        }

    companies = get_active_companies(db)
    if company_limit is not None and company_limit >= 0:
        companies = companies[:company_limit]
    raw_postings: List[RawJobPosting] = []

    async with httpx.AsyncClient(timeout=20.0) as client:
        for c in companies:
            cname = c.get("company", "")
            gh_token = c.get("greenhouse_token")
            lever_slug = c.get("lever")
            ashby_slug = c.get("ashby")

            # Greenhouse
            if gh_token and (not requested_sources or "greenhouse" in requested_sources):
                try:
                    jobs = await fetch_greenhouse_jobs(gh_token, cname, client)
                    raw_postings.extend(jobs)
                except Exception as exc:
                    logger.error("Greenhouse error for %s: %s", cname, exc)

            # Lever
            if lever_slug and (not requested_sources or "lever" in requested_sources):
                try:
                    jobs = await fetch_lever_jobs(lever_slug, cname, client)
                    raw_postings.extend(jobs)
                except Exception as exc:
                    logger.error("Lever error for %s: %s", cname, exc)

            # Ashby
            if ashby_slug and (not requested_sources or "ashby" in requested_sources):
                try:
                    jobs = await fetch_ashby_jobs(ashby_slug, cname, client)
                    raw_postings.extend(jobs)
                except Exception as exc:
                    logger.error("Ashby error for %s: %s", cname, exc)

    new_jobs_count = 0
    duplicate_count = 0
    filtered_count = 0

    for raw in raw_postings:
        canonical = canonicalize_url(raw.application_url or raw.source_url)
        ats_provider = detect_ats_provider(canonical) or raw.source
        app_type = detect_application_type(canonical, raw.source)

        url_fp = compute_url_fingerprint(canonical)
        sem_fp = compute_semantic_fingerprint(raw.company, raw.title, raw.workplace_type)

        is_dup, existing_id, existing_job = check_duplicate(db, url_fp, sem_fp)
        if is_dup:
            duplicate_count += 1
            continue

        clean_desc = sanitize_job_description(raw.description_raw)

        max_sal = raw.salary_raw.get("max") if raw.salary_raw else None
        passed, reject_reason = run_prefilter(
            title=raw.title,
            description_text=clean_desc,
            workplace_type=raw.workplace_type,
            salary_max=max_sal,
            candidate_profile=candidate_profile,
        )

        job_status = "score_queued" if passed else "filtered_out"
        if not passed:
            filtered_count += 1
        else:
            new_jobs_count += 1

        job_entry = Job(
            id=str(uuid.uuid4()),
            fingerprint=url_fp,
            source=raw.source,
            source_job_id=raw.source_job_id,
            source_url=raw.source_url,
            canonical_url=canonical,
            title=raw.title,
            company=raw.company,
            location=raw.location,
            workplace_type=raw.workplace_type,
            salary_info=json.dumps(raw.salary_raw) if raw.salary_raw else None,
            employment_type=raw.employment_type,
            description_raw=raw.description_raw,
            description_clean=clean_desc,
            application_type=app_type,
            ats_provider=ats_provider,
            application_url=canonical,
            date_posted=raw.date_posted,
            status=job_status,
            match_reasons=[reject_reason] if reject_reason else [],
            job_metadata={
                **raw.metadata,
                "semantic_fingerprint": sem_fp,
            },
        )
        db.add(job_entry)

    db.commit()

    sweep_result = {
        "sweepId": sweep_id,
        "new_jobs": new_jobs_count,
        "duplicate": duplicate_count,
        "filtered": filtered_count,
    }

    # Emit telemetry event
    await hub.broadcast("SWEEP_COMPLETED", sweep_result)
    logger.info("Sweep %s complete: %s", sweep_id, sweep_result)
    return sweep_result
