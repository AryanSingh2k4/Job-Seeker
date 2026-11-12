"""Selection-only resume tailoring engine (§6.2)."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Set, Tuple

from app.matcher.factcheck import fact_check_resume
from app.schemas.job import ParsedJobProfile
from app.schemas.profile import CandidateProfileOut

logger = logging.getLogger(__name__)


@dataclass
class TailoredResumeData:
    candidate_id: str
    job_id: str
    full_name: str
    email: str
    phone: str
    location: str
    linkedin_url: str | None
    github_url: str | None
    summary_sentence: str
    skills_by_category: Dict[str, List[str]]
    experiences: List[Dict[str, Any]]
    education: List[Dict[str, Any]]
    projects: List[Dict[str, Any]]
    selected_bullet_ids: List[str] = field(default_factory=list)
    fact_check_status: str = "PASSED"
    fact_check_reasons: List[str] = field(default_factory=list)


def tailor_resume(
    profile: CandidateProfileOut,
    job_id: str,
    parsed_job: ParsedJobProfile,
) -> TailoredResumeData:
    """Select and order verified bullet points and skills matching the target job description."""
    req_skills: Set[str] = {s.lower() for s in (parsed_job.required_hard_skills or [])}

    # Master bullet pool lookup: id -> raw_text
    master_bullets: Dict[str, str] = {}
    for exp in profile.work_experiences:
        for b in exp.bullets:
            if b.verified:
                master_bullets[b.id] = b.raw_text
    for proj in profile.projects:
        for b in proj.bullets:
            if b.verified:
                master_bullets[b.id] = b.raw_text

    selected_bullet_ids: List[str] = []
    selected_bullet_texts: List[str] = []

    # 1. Rank & select work experiences (max 3 roles)
    tailored_experiences = []
    for exp in profile.work_experiences[:3]:
        # Score bullets by intersection with required skills
        scored_bullets = []
        for b in exp.bullets:
            if not b.verified:
                continue
            overlap = len(set(s.lower() for s in b.skills_used) & req_skills)
            scored_bullets.append((overlap, b.priority_score, b))

        # Sort desc by overlap then priority
        scored_bullets.sort(key=lambda x: (x[0], x[1]), reverse=True)
        top_bullets = [b for _, _, b in scored_bullets[:5]]  # Max 5 bullets per role

        for b in top_bullets:
            selected_bullet_ids.append(b.id)
            selected_bullet_texts.append(b.raw_text)

        tailored_experiences.append({
            "company_name": exp.company_name,
            "role_title": exp.role_title,
            "location": exp.location,
            "start_date": exp.start_date,
            "end_date": exp.end_date or "Present",
            "bullets": [b.raw_text for b in top_bullets],
        })

    # 2. Fact-check selected bullets
    passed, reasons = fact_check_resume(selected_bullet_texts, master_bullets)

    # 3. Categorize skills
    skills_by_cat: Dict[str, List[str]] = {}
    for s in profile.skills:
        cat = s.category or "Technical"
        skills_by_cat.setdefault(cat, []).append(s.canonical_name)

    # Prioritize skills that intersect with required skills
    for cat, slist in skills_by_cat.items():
        slist.sort(key=lambda sname: 1 if sname.lower() in req_skills else 0, reverse=True)

    return TailoredResumeData(
        candidate_id=profile.id,
        job_id=job_id,
        full_name=profile.full_name,
        email=profile.email,
        phone=profile.phone,
        location=f"{profile.city}, {profile.state}",
        linkedin_url=profile.linkedin_url,
        github_url=profile.github_url,
        summary_sentence=profile.summary_baseline,
        skills_by_category=skills_by_cat,
        experiences=tailored_experiences,
        education=[
            {
                "institution": e.institution,
                "degree": e.degree,
                "field_of_study": e.field_of_study,
                "start_year": e.start_year,
                "end_year": e.end_year,
            }
            for e in profile.education
        ],
        projects=[
            {
                "name": p.name,
                "description": p.description,
                "technologies": p.technologies,
                "bullets": [b.raw_text for b in p.bullets if b.verified][:3],
            }
            for p in profile.projects
        ],
        selected_bullet_ids=selected_bullet_ids,
        fact_check_status="PASSED" if passed else "FAILED",
        fact_check_reasons=reasons,
    )
