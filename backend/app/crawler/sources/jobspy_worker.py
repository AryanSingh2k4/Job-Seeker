"""Python-JobSpy aggregator worker with circuit breaker (§6.1)."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List
from app.crawler.models import RawJobPosting

logger = logging.getLogger(__name__)

# Circuit breaker state
_ERROR_COUNT = 0
_CIRCUIT_OPEN_UNTIL: Optional[datetime] = None


class JobSpyWorker:
    @staticmethod
    def is_available() -> bool:
        global _CIRCUIT_OPEN_UNTIL
        if _CIRCUIT_OPEN_UNTIL and datetime.now(timezone.utc) < _CIRCUIT_OPEN_UNTIL:
            return False
        return True

    @staticmethod
    def record_failure() -> None:
        global _ERROR_COUNT, _CIRCUIT_OPEN_UNTIL
        _ERROR_COUNT += 1
        if _ERROR_COUNT >= 3:
            logger.warning("JobSpy circuit breaker tripped. Pausing for 24h.")
            _CIRCUIT_OPEN_UNTIL = datetime.now(timezone.utc).replace(day=datetime.now(timezone.utc).day + 1)

    @staticmethod
    def record_success() -> None:
        global _ERROR_COUNT, _CIRCUIT_OPEN_UNTIL
        _ERROR_COUNT = 0
        _CIRCUIT_OPEN_UNTIL = None

    @staticmethod
    async def scrape(search_term: str = "Software Engineer", location: str = "United States") -> List[RawJobPosting]:
        if not JobSpyWorker.is_available():
            logger.info("JobSpy circuit open — skipping sweep.")
            return []

        def _sync_scrape():
            try:
                from jobspy import scrape_jobs
                jobs_df = scrape_jobs(
                    site_name=["linkedin", "indeed"],
                    search_term=search_term,
                    location=location,
                    results_wanted=10,
                    hours_old=72,
                )
                return jobs_df
            except Exception as e:
                logger.warning("JobSpy scrape exception: %s", e)
                raise e

        try:
            df = await asyncio.to_thread(_sync_scrape)
            JobSpyWorker.record_success()
            results = []
            if df is not None and not df.empty:
                for _, row in df.iterrows():
                    results.append(
                        RawJobPosting(
                            source=str(row.get("site", "jobspy")),
                            source_job_id=str(row.get("id", "")),
                            source_url=str(row.get("job_url", "")),
                            title=str(row.get("title", "")),
                            company=str(row.get("company", "")),
                            location=str(row.get("location", "Remote")),
                            description_raw=str(row.get("description", "")),
                            application_url=str(row.get("job_url", "")),
                            workplace_type="remote" if "remote" in str(row.get("location", "")).lower() else "unknown",
                        )
                    )
            return results
        except Exception:
            JobSpyWorker.record_failure()
            return []
