"""URL canonicalization and ATS provider detection (§6.1)."""

from __future__ import annotations

import re
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

STRIP_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "ref",
    "reference",
    "source",
    "trackingid",
    "tracking_id",
    "fbclid",
    "gclid",
    "trk",
    "midtoken",
}


def canonicalize_url(url: str) -> str:
    """Strip tracking and marketing query parameters, normalize host."""
    parsed = urlparse(url.strip())
    query_pairs = parse_qsl(parsed.query, keep_blank_values=False)
    filtered = [(k, v) for k, v in query_pairs if k.lower() not in STRIP_PARAMS]
    new_query = urlencode(filtered)
    # Lowercase scheme and netloc, strip trailing slash from path
    path = parsed.path.rstrip("/") if parsed.path != "/" else "/"
    return urlunparse((
        parsed.scheme.lower(),
        parsed.netloc.lower(),
        path,
        parsed.params,
        new_query,
        "",  # drop fragment
    ))


def detect_ats_provider(url: str) -> str:
    """Detect ATS provider from hostname/path."""
    u = url.lower()
    if "greenhouse.io" in u:
        return "greenhouse"
    if "lever.co" in u:
        return "lever"
    if "ashbyhq.com" in u:
        return "ashby"
    if "myworkdayjobs.com" in u or "workday" in u:
        return "workday"
    if "smartrecruiters.com" in u:
        return "smartrecruiters"
    if "icims.com" in u:
        return "icims"
    if "taleo.net" in u:
        return "taleo"
    if "bamboohr.com" in u:
        return "bamboohr"
    if "linkedin.com" in u:
        return "linkedin"
    return "unknown"


def detect_application_type(url: str, source: str) -> str:
    provider = detect_ats_provider(url)
    if provider in {"greenhouse", "lever", "ashby"}:
        return "ats_direct"
    if source == "linkedin" and "/jobs/view/" in url:
        return "easy_apply"
    if provider == "workday":
        return "external_form"
    return "external_form"
