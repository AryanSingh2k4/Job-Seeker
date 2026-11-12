"""Zero-cost regex pre-filtering rules (§6.1)."""

from __future__ import annotations

import re
from typing import Any, Dict, Optional, Tuple

DEFAULT_EXCLUDE_TITLES = re.compile(
    r"\b(director|vp|vice president|sales|account executive|recruiter|sales development|head of)\b",
    re.IGNORECASE,
)

VISA_BLOCK_PHRASES = re.compile(
    r"\b(us citizen only|citizenship required|u\.s\. citizen|no visa sponsorship|not eligible for visa sponsorship|must possess active security clearance|must have ts/sci)\b",
    re.IGNORECASE,
)


def run_prefilter(
    title: str,
    description_text: str,
    workplace_type: str,
    salary_max: Optional[float],
    candidate_profile: Optional[Dict[str, Any]] = None,
) -> Tuple[bool, Optional[str]]:
    """Fast regex pre-filter to reject noise before any LLM evaluation."""
    prefs = candidate_profile.get("target_preferences", {}) if candidate_profile else {}

    # 1. Title blacklist
    exclude_pattern = DEFAULT_EXCLUDE_TITLES
    custom_exclude = prefs.get("exclude_titles")
    if custom_exclude:
        try:
            exclude_pattern = re.compile(custom_exclude, re.IGNORECASE)
        except Exception:
            pass

    if exclude_pattern.search(title):
        return False, "title_blacklisted"

    # 2. Visa sponsorship blocklist
    requires_sponsorship = candidate_profile.get("requires_sponsorship", False) if candidate_profile else False
    if requires_sponsorship:
        if VISA_BLOCK_PHRASES.search(description_text):
            return False, "visa_sponsorship_unavailable"

    # 3. Salary floor check
    target_min = candidate_profile.get("target_salary_min") if candidate_profile else None
    if target_min and salary_max and salary_max < target_min:
        return False, f"salary_below_floor ({salary_max} < {target_min})"

    # 4. Strict remote mismatch check
    remote_only = prefs.get("remote_only", False)
    if remote_only and workplace_type == "onsite":
        return False, "onsite_conflict_with_remote_only"

    return True, None
