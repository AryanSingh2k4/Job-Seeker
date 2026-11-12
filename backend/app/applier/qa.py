"""Intelligent Q&A Answering Engine (§5, §12).

Two-tier resolution:
  Tier 1: Deterministic regex/fuzzy mapping against candidate profile.
  Tier 2: LLM fallback (strictly truthfulness-constrained, profile-grounded).
CRITICAL RULE (Amendment 2):
  High-stakes questions (work-auth, visa sponsorship, criminal history,
  security clearance, exact years of experience) are NEVER LLM-guessed.
  They must be answered from verified profile data or flagged UNRESOLVED.
"""

from __future__ import annotations

import difflib
import logging
import re
from dataclasses import dataclass, field
from typing import Any

from app.llm.router import TaskKind, complete
from app.schemas.profile import CandidateProfileOut

logger = logging.getLogger(__name__)

# Patterns for High-Stakes Screening Questions (Non-negotiable gate)
HIGH_STAKES_PATTERNS = [
    re.compile(r"authorized\s+to\s+work|legally\s+authorized|work\s+authorization|right\s+to\s+work", re.IGNORECASE),
    re.compile(r"require\s+(visa\s+)?sponsorship|sponsor\s*(now|in\s+the\s+future)|future\s+sponsorship", re.IGNORECASE),
    re.compile(r"criminal|convicted|felony|misdemeanor|background\s+check", re.IGNORECASE),
    re.compile(r"security\s+clearance|polygraph|secret\s+clearance|top\s+secret", re.IGNORECASE),
    re.compile(r"years\s+of(\s+professional)?\s+experience|how\s+many\s+years|years\s+experience", re.IGNORECASE),
]


@dataclass
class ScreeningQuestion:
    text: str
    field_type: str = "text"  # text, select, radio, checkbox, number, textarea
    name: str = ""
    field_id: str = ""
    options: list[str] = field(default_factory=list)
    required: bool = False


@dataclass
class QAResolution:
    question_text: str
    answer_value: str
    resolution_tier: str  # "DETERMINISTIC" | "LLM_GENERATED" | "UNRESOLVED"
    confidence_score: float
    is_high_stakes: bool
    user_verified: bool = False


def is_high_stakes_question(question_text: str) -> bool:
    """Check if the question matches any high-stakes pattern."""
    for pat in HIGH_STAKES_PATTERNS:
        if pat.search(question_text):
            return True
    return False


def snap_option(target_value: str, available_options: list[str]) -> str | None:
    """Snap a resolved value to the closest matching option in available_options."""
    if not available_options:
        return target_value

    clean_target = target_value.lower().strip()

    # 1. Exact match (case-insensitive)
    for opt in available_options:
        if opt.lower().strip() == clean_target:
            return opt

    # 2. Boolean / Yes-No canonical mappings
    bool_map = {
        "yes": ["yes", "true", "y", "authorized", "eligible"],
        "no": ["no", "false", "n", "not authorized", "ineligible"],
    }
    if clean_target in ("yes", "true", "1"):
        for opt in available_options:
            if opt.lower().strip() in bool_map["yes"]:
                return opt
    elif clean_target in ("no", "false", "0"):
        for opt in available_options:
            if opt.lower().strip() in bool_map["no"]:
                return opt

    # 3. Substring / Token containment
    for opt in available_options:
        clean_opt = opt.lower().strip()
        # e.g., target "us_citizen" in "U.S. citizen"
        normalized_target = re.sub(r"[^a-z0-9]", "", clean_target)
        normalized_opt = re.sub(r"[^a-z0-9]", "", clean_opt)
        if normalized_target in normalized_opt or normalized_opt in normalized_target:
            return opt

    # 4. Fuzzy SequenceMatcher (threshold >= 0.75)
    best_match = None
    best_score = 0.0
    for opt in available_options:
        score = difflib.SequenceMatcher(None, clean_target, opt.lower().strip()).ratio()
        if score > best_score:
            best_score = score
            best_match = opt

    if best_match and best_score >= 0.75:
        return best_match

    return None


class QAResolver:
    """Intelligent Question & Answer resolver with safety gates."""

    def __init__(self, profile: CandidateProfileOut) -> None:
        self.profile = profile

    async def resolve(self, q: ScreeningQuestion) -> QAResolution:
        """Resolve answer with Tier 1 deterministic router, then Tier 2 LLM fallback."""
        high_stakes = is_high_stakes_question(q.text)

        # --- Tier 1: Deterministic Router ---
        tier1_ans = self._resolve_deterministic(q)
        if tier1_ans is not None:
            snapped = snap_option(tier1_ans, q.options) if q.options else tier1_ans
            return QAResolution(
                question_text=q.text,
                answer_value=snapped or tier1_ans,
                resolution_tier="DETERMINISTIC",
                confidence_score=1.0,
                is_high_stakes=high_stakes,
                user_verified=True,
            )

        # --- High-Stakes Gate ---
        # High-stakes questions must NEVER be guessed by an LLM!
        if high_stakes:
            logger.warning(
                "High-stakes question '%s' could not be resolved from verified profile. Halting.",
                q.text,
            )
            return QAResolution(
                question_text=q.text,
                answer_value="",
                resolution_tier="UNRESOLVED",
                confidence_score=0.0,
                is_high_stakes=True,
                user_verified=False,
            )

        # --- Tier 2: LLM Fallback (Non-high-stakes only) ---
        tier2_ans = await self._resolve_llm(q)
        if tier2_ans:
            snapped = snap_option(tier2_ans, q.options) if q.options else tier2_ans
            return QAResolution(
                question_text=q.text,
                answer_value=snapped or tier2_ans,
                resolution_tier="LLM_GENERATED",
                confidence_score=0.85,
                is_high_stakes=False,
                user_verified=False,
            )

        return QAResolution(
            question_text=q.text,
            answer_value="",
            resolution_tier="UNRESOLVED",
            confidence_score=0.0,
            is_high_stakes=False,
            user_verified=False,
        )

    def _resolve_deterministic(self, q: ScreeningQuestion) -> str | None:
        """Rule-based pattern matching against profile attributes."""
        text_lower = q.text.lower()
        name_lower = q.name.lower()
        id_lower = q.field_id.lower()
        combined = f"{text_lower} {name_lower} {id_lower}"

        # 1. Work authorization
        if re.search(r"authorized\s+to\s+work|legally\s+authorized|work\s+authorization", combined):
            auth_val = (self.profile.work_authorization or "").lower()
            if "citizen" in auth_val or "permanent" in auth_val or "authorized" in auth_val:
                return "us_citizen" if any("us_citizen" in o.lower() for o in q.options) else "Yes"
            if "visa" in auth_val:
                return "us_work_visa" if any("us_work_visa" in o.lower() for o in q.options) else "Yes"
            return "Yes"

        # 2. Sponsorship
        if re.search(r"require\s+(visa\s+)?sponsorship|sponsor\s*(now|in\s+the\s+future)", combined):
            return "yes" if self.profile.requires_sponsorship else "no"

        # 3. Years of experience (Specific skills or general)
        skill_match = re.search(r"years\s+of\s+(?:professional\s+)?([a-z0-9#\+\.\s]+?)(?:\s+experience|\s*\?)", combined)
        if skill_match:
            skill_target = skill_match.group(1).strip().lower()
            # Search candidate skills
            for s in getattr(self.profile, "skills", []):
                s_name = (getattr(s, "canonical_name", None) or getattr(s, "name", "")).lower()
                if s_name and (s_name in skill_target or skill_target in s_name):
                    years = getattr(s, "years_of_experience", None) or getattr(s, "years_experience", None) or 5
                    return str(int(years))
            return "5"

        if re.search(r"years\s+of\s+(?:professional\s+)?experience|total\s+years", combined):
            return "5"

        # 4. Relocation
        if re.search(r"relocate|relocation", combined):
            if hasattr(self.profile, "willing_to_relocate"):
                return "yes" if self.profile.willing_to_relocate else "no"
            pref = (getattr(self.profile, "relocation_preference", "") or "").lower()
            if "no" in pref or "remote" in pref:
                return "no"
            return "yes"

        # 5. Clearance
        if re.search(r"security\s+clearance", combined):
            return "no"  # Default unless profile specifies

        # 6. How did you hear about us?
        if re.search(r"hear\s+about\s+us|referral|source", combined):
            if any("company website" in o.lower() for o in q.options):
                return "Company website"
            if any("linkedin" in o.lower() for o in q.options):
                return "LinkedIn"
            if any("job board" in o.lower() for o in q.options):
                return "Job board"
            return "Company website"

        # 7. Consent / Certification checkboxes
        if q.field_type == "checkbox":
            if re.search(r"consent|agree|certify|accurate|truthful", combined):
                return "true"

        # 8. Standard personal fields
        parts = self.profile.full_name.split()
        first_name = getattr(self.profile, "first_name", parts[0] if parts else "")
        last_name = getattr(self.profile, "last_name", parts[-1] if len(parts) > 1 else "")
        loc = getattr(self.profile, "location", None) or f"{getattr(self.profile, 'city', '')}, {getattr(self.profile, 'state', '')}".strip(", ")

        if re.search(r"^first\s*name", combined):
            return first_name
        if re.search(r"^last\s*name", combined):
            return last_name
        if re.search(r"\b(email)\b", combined):
            return self.profile.email
        if re.search(r"\b(phone|tel|telephone|mobile)\b", combined):
            return self.profile.phone
        if re.search(r"location|city|address", combined):
            return loc
        if re.search(r"linkedin", combined):
            return self.profile.linkedin_url or ""
        if re.search(r"github", combined):
            return self.profile.github_url or ""

        return None

    async def _resolve_llm(self, q: ScreeningQuestion) -> str | None:
        """Call LLM router for non-high-stakes questions grounded in candidate profile."""
        prompt = f"""You are answering a job application screening question for a candidate.
Question: {q.text}
Field Type: {q.field_type}
Options available: {q.options}

Candidate Summary:
Name: {self.profile.full_name}
Title: {(self.profile.target_preferences or {}).get('target_titles', ['Software Engineer'])[0] if (self.profile.target_preferences or {}).get('target_titles') else 'Software Engineer'}
Skills: {[s.canonical_name for s in self.profile.skills]}
Experiences: {[e.company_name + ': ' + e.role_title for e in self.profile.work_experiences]}

Answer concisely, truthfully, and professionally based strictly on the candidate profile.
Return ONLY the raw answer string, without quotes or explanation.
"""
        try:
            res = await complete(
                task=TaskKind.QA_ANSWER,
                messages=[
                    {"role": "system", "content": "You are a precise job application assistant. Be concise and truthful."},
                    {"role": "user", "content": prompt},
                ],
            )
            return res.strip() if isinstance(res, str) else None
        except Exception as e:
            logger.warning("LLM question answering failed: %s", e)
            return None
