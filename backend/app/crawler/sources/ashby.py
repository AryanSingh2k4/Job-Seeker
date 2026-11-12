"""Ashby Board API crawler source (§6.1).

Queries public Ashby posting endpoint:
POST https://api.ashbyhq.com/posting-api/job-board/{company}
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import List
import httpx

from app.crawler.models import RawJobPosting

logger = logging.getLogger(__name__)


async def fetch_ashby_jobs(company_slug: str, company_name: str, client: httpx.AsyncClient | None = None) -> List[RawJobPosting]:
    url = f"https://api.ashbyhq.com/posting-api/job-board/{company_slug}"
    should_close = False
    if client is None:
        client = httpx.AsyncClient(timeout=15.0)
        should_close = True

    postings: List[RawJobPosting] = []
    try:
        resp = await client.post(url, json={})
        if resp.status_code == 404:
            logger.info("Ashby board not found for %s (%s)", company_name, company_slug)
            return []
        resp.raise_for_status()
        data = resp.json()
        jobs = data.get("jobs", [])

        for j in jobs:
            job_id = str(j.get("id"))
            title = j.get("title", "").strip()
            if not title:
                continue

            location_name = j.get("location", "Unknown")
            is_remote = j.get("isRemote", False)
            workplace = "remote" if is_remote else "unknown"
            if not is_remote and location_name and location_name.lower() != "unknown":
                workplace = "onsite"

            published_at = j.get("publishedAt")
            posted_dt = None
            if published_at:
                try:
                    posted_dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
                except Exception:
                    pass

            app_url = j.get("jobUrl") or j.get("applyUrl") or f"https://jobs.ashbyhq.com/{company_slug}/{job_id}"

            # Compensation
            comp = j.get("compensation")
            salary_raw = None
            if comp:
                salary_raw = {
                    "min": comp.get("minValue"),
                    "max": comp.get("maxValue"),
                    "currency": comp.get("currencyCode", "USD"),
                    "interval": comp.get("period", "yearly").lower(),
                }

            postings.append(
                RawJobPosting(
                    source="ashby",
                    source_job_id=job_id,
                    source_url=app_url,
                    title=title,
                    company=company_name,
                    location=location_name,
                    description_raw=j.get("descriptionHtml") or j.get("descriptionPlain") or "",
                    application_url=app_url,
                    workplace_type=workplace,
                    employment_type=j.get("employmentType", "FullTime").lower(),
                    salary_raw=salary_raw,
                    date_posted=posted_dt,
                    metadata={
                        "department": j.get("department"),
                        "custom_fields": j.get("customFields", []),
                    },
                )
            )
    except Exception as exc:
        logger.error("Ashby fetch error for %s: %s", company_name, exc)
    finally:
        if should_close:
            await client.aclose()

    return postings
