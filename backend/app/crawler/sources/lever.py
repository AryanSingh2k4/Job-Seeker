"""Lever Board API crawler source (§6.1).

Queries public Lever postings endpoint:
GET https://api.lever.co/v0/postings/{company}?mode=json
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List
import httpx

from app.crawler.models import RawJobPosting

logger = logging.getLogger(__name__)


async def fetch_lever_jobs(company_slug: str, company_name: str, client: httpx.AsyncClient | None = None) -> List[RawJobPosting]:
    url = f"https://api.lever.co/v0/postings/{company_slug}?mode=json"
    should_close = False
    if client is None:
        client = httpx.AsyncClient(timeout=15.0)
        should_close = True

    postings: List[RawJobPosting] = []
    try:
        resp = await client.get(url)
        if resp.status_code == 404:
            logger.info("Lever board not found for %s (%s)", company_name, company_slug)
            return []
        resp.raise_for_status()
        jobs = resp.json()

        for j in jobs:
            job_id = str(j.get("id"))
            title = j.get("text", "").strip()
            if not title:
                continue

            categories = j.get("categories", {})
            location_name = categories.get("location", "Unknown")
            commitment = categories.get("commitment", "full-time")

            workplace = "unknown"
            loc_lower = location_name.lower()
            workplace_type_str = (j.get("workplaceType") or "").lower()
            if "remote" in workplace_type_str or "remote" in loc_lower:
                workplace = "remote"
            elif "hybrid" in workplace_type_str or "hybrid" in loc_lower:
                workplace = "hybrid"
            elif loc_lower and loc_lower != "unknown":
                workplace = "onsite"

            created_at_ms = j.get("createdAt")
            posted_dt = None
            if created_at_ms:
                try:
                    posted_dt = datetime.fromtimestamp(created_at_ms / 1000.0, tz=timezone.utc)
                except Exception:
                    pass

            desc_parts = [j.get("description", "")]
            for lst in j.get("lists", []):
                desc_parts.append(f"<h3>{lst.get('text', '')}</h3>")
                desc_parts.append(lst.get("content", ""))
            if j.get("additional"):
                desc_parts.append(j.get("additional", ""))
            full_raw = "\n".join(desc_parts)

            app_url = j.get("hostedUrl") or j.get("applyUrl") or f"https://jobs.lever.co/{company_slug}/{job_id}"

            postings.append(
                RawJobPosting(
                    source="lever",
                    source_job_id=job_id,
                    source_url=app_url,
                    title=title,
                    company=company_name,
                    location=location_name,
                    description_raw=full_raw,
                    application_url=app_url,
                    workplace_type=workplace,
                    employment_type=commitment,
                    date_posted=posted_dt,
                    metadata={
                        "team": categories.get("team"),
                        "department": categories.get("department"),
                    },
                )
            )
    except Exception as exc:
        logger.error("Lever fetch error for %s: %s", company_name, exc)
    finally:
        if should_close:
            await client.aclose()

    return postings
