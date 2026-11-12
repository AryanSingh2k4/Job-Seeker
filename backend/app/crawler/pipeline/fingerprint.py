"""Deduplication fingerprinting for JobSeeker (§6.1)."""

from __future__ import annotations

import hashlib
import re

SENIORITY_WORDS = re.compile(r"\b(senior|sr|junior|jr|lead|staff|principal|intern|internship|associate|entry|mid|level|ii|iii|iv|v)\b", re.IGNORECASE)
NON_ALPHANUMERIC = re.compile(r"[^a-z0-9]")


def compute_url_fingerprint(canonical_url: str) -> str:
    """Tier A: SHA-256 of canonical URL."""
    return hashlib.sha256(canonical_url.strip().lower().encode("utf-8")).hexdigest()


def compute_semantic_fingerprint(company: str, title: str, location_type: str = "unknown") -> str:
    """Tier B: Composite semantic hash of normalized company + stripped title + location type."""
    clean_company = NON_ALPHANUMERIC.sub("", company.strip().lower())
    title_no_seniority = SENIORITY_WORDS.sub("", title.strip().lower())
    clean_title = NON_ALPHANUMERIC.sub("", title_no_seniority)
    clean_loc = NON_ALPHANUMERIC.sub("", location_type.strip().lower())

    composite = f"{clean_company}:{clean_title}:{clean_loc}"
    return hashlib.sha256(composite.encode("utf-8")).hexdigest()
