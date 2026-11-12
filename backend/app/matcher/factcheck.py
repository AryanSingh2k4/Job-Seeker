"""Anti-hallucination fact-checking diff guardrail (§6.2)."""

from __future__ import annotations

import re
from typing import Dict, List, Set, Tuple

METRIC_PATTERN = re.compile(r"[$€£]?\d[\d,.]*\s*(%|k|m|x|bn|billion|million)?", re.IGNORECASE)


class MetricTamperingException(Exception):
    """Raised when numerical metrics in a tailored bullet do not match master facts."""
    pass


def extract_metrics(text: str) -> Set[str]:
    """Extract normalized numeric tokens from text."""
    matches = METRIC_PATTERN.findall(text)
    # finditer gives full match strings
    return {m.group(0).strip().lower() for m in METRIC_PATTERN.finditer(text)}


def normalize_whitespace(text: str) -> str:
    return " ".join(text.strip().split())


def validate_tailored_bullet(
    tailored_text: str,
    master_bullet_text: str,
) -> Tuple[bool, str]:
    """Validate that tailored bullet matches ground truth without altered claims or metrics."""
    norm_tailored = normalize_whitespace(tailored_text)
    norm_master = normalize_whitespace(master_bullet_text)

    # 1. Verbatim check (selection-only rule)
    if norm_tailored != norm_master:
        return False, f"bullet_modified (tailored='{norm_tailored}' != master='{norm_master}')"

    # 2. Immutable metrics check
    tailored_metrics = extract_metrics(norm_tailored)
    master_metrics = extract_metrics(norm_master)

    if tailored_metrics != master_metrics:
        diff = tailored_metrics ^ master_metrics
        raise MetricTamperingException(
            f"Metric tampering detected: difference={diff} in bullet '{norm_tailored}'"
        )

    return True, "ok"


def fact_check_resume(
    selected_bullets: List[str],
    master_bullet_pool: Dict[str, str],
) -> Tuple[bool, List[str]]:
    """Validate all selected bullets against the candidate master fact pool."""
    reasons: List[str] = []
    all_passed = True

    for bullet_text in selected_bullets:
        # Must exist in verified master pool
        found = False
        for m_id, m_text in master_bullet_pool.items():
            if normalize_whitespace(bullet_text) == normalize_whitespace(m_text):
                try:
                    passed, msg = validate_tailored_bullet(bullet_text, m_text)
                    if not passed:
                        all_passed = False
                        reasons.append(msg)
                    found = True
                    break
                except MetricTamperingException as exc:
                    all_passed = False
                    reasons.append(str(exc))
                    found = True
                    break

        if not found:
            all_passed = False
            reasons.append(f"unearned_bullet ('{bullet_text[:40]}...' not found in master profile)")

    return all_passed, reasons
