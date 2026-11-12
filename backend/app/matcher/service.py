"""Matcher queue processing service for JobSeeker (§6.2)."""

from __future__ import annotations

import logging
from sqlalchemy.orm import Session
from app.api.routes.profile import get_profile
from app.matcher.extract import extract_job_profile
from app.matcher.score import compute_match_score
from app.models.job import Job

logger = logging.getLogger(__name__)


async def process_score_queue(db: Session, batch_size: int = 5) -> int:
    """Process pending score_queued jobs, compute compatibility, and triage."""
    jobs = db.query(Job).filter(Job.status == "score_queued").order_by(Job.date_discovered.asc()).limit(batch_size).all()
    if not jobs:
        return 0

    candidate_profile = None
    try:
        candidate_profile = get_profile(db)
    except Exception:
        pass

    processed = 0
    for job in jobs:
        try:
            parsed = await extract_job_profile(job.description_clean)
            breakdown = compute_match_score(parsed, candidate_profile)

            job.match_score = breakdown.final
            job.skills_required = parsed.required_hard_skills

            # Triage thresholds (§6.2)
            if not breakdown.hard_gate.passed or breakdown.final < 65.0:
                job.status = "skipped"
                reasons = breakdown.hard_gate.reasons or [f"score_below_threshold ({breakdown.final} < 65)"]
                job.match_reasons = reasons
            else:
                job.status = "scored"
                job.match_reasons = [f"score_{breakdown.final}"]

            meta = dict(job.job_metadata or {})
            meta["parsed"] = parsed.model_dump()
            job.job_metadata = meta

            processed += 1
        except Exception as exc:
            logger.error("Error scoring job %s: %s", job.id, exc)

    db.commit()
    return processed
