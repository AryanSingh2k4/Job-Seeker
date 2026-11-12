"""Greenhouse Board API crawler source (§6.1).

Queries public Greenhouse board endpoint:
GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import List
import httpx

from app.crawler.models import RawJobPosting

logger = logging.getLogger(__name__)


async def fetch_greenhouse_jobs(board_token: str, company_name: str, client: httpx.AsyncClient | None = None) -> List[RawJobPosting]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true"
    should_close = False
    if client is None:
        client = httpx.AsyncClient(timeout=15.0)
        should_close = True

    postings: List[RawJobPosting] = []
    try:
        resp = await client.get(url)
        if resp.status_code == 404:
            logger.info("Greenhouse board not found for %s (%s)", company_name, board_token)
            return []
        resp.raise_for_status()
        data = resp.json()
        jobs = data.get("jobs", [])

        for j in jobs:
            job_id = str(j.get("id"))
            title = j.get("title", "").strip()
            if not title:
                continue

            location_obj = j.get("location", {})
            location_name = location_obj.get("name", "Unknown") if isinstance(location_obj, dict) else str(location_obj)

            workplace = "unknown"
            loc_lower = location_name.lower()
            if "remote" in loc_lower:
                workplace = "remote"
            elif "hybrid" in loc_lower:
                workplace = "hybrid"
            elif loc_lower and loc_lower != "unknown":
                workplace = "onsite"

            updated_at_str = j.get("updated_at")
            posted_dt = None
            if updated_at_str:
                try:
                    posted_dt = datetime.fromisoformat(updated_at_str.replace("Z", "+00:00"))
                except Exception:
                    pass

            app_url = j.get("absolute_url") or f"https://boards.greenhouse.io/{board_token}/jobs/{job_id}"

            postings.append(
                RawJobPosting(
                    source="greenhouse",
                    source_job_id=job_id,
                    source_url=app_url,
                    title=title,
                    company=company_name,
                    location=location_name,
                    description_raw=j.get("content", ""),
                    application_url=app_url,
                    workplace_type=workplace,
                    employment_type="full-time",
                    date_posted=posted_dt,
                    metadata={
                        "departments": [d.get("name") for d in j.get("departments", []) if isinstance(d, dict)],
                        "offices": [o.get("name") for o in j.get("offices", []) if isinstance(o, dict)],
                    },
                )
            )
    except Exception as exc:
        logger.error("Greenhouse fetch error for %s: %s", company_name, exc)
    finally:
        if should_close:
            await client.aclose()

    return postings
