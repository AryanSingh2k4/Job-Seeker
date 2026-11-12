"""JD entity extraction pipeline for JobSeeker (§6.2)."""

from __future__ import annotations

import re
from typing import List
from app.llm.prompts import PROMPT_JD_EXTRACTION
from app.llm.router import TaskKind, complete
from app.schemas.job import ParsedJobProfile

COMMON_TECH_SKILLS = [
    "Python", "FastAPI", "Django", "Flask", "Go", "Golang", "Rust", "Java",
    "Kotlin", "C++", "C#", ".NET", "TypeScript", "JavaScript", "React",
    "Node.js", "Vue", "Next.js", "SQL", "PostgreSQL", "MySQL", "SQLite",
    "Redis", "MongoDB", "Kafka", "RabbitMQ", "AWS", "GCP", "Azure",
    "Docker", "Kubernetes", "Terraform", "CI/CD", "Linux", "Git", "REST",
    "GraphQL", "gRPC", "Microservices", "Distributed Systems"
]

YEARS_PATTERN = re.compile(r"(\d+)\+?\s*years?(?:\s+of)?(?:\s+experience)?", re.IGNORECASE)
SENIORITY_PATTERN = re.compile(r"\b(intern|internship|junior|entry|mid|senior|staff|principal|lead)\b", re.IGNORECASE)
VISA_NO_PATTERN = re.compile(r"\b(no visa sponsorship|not eligible for sponsorship|us citizen only|citizenship required)\b", re.IGNORECASE)
VISA_YES_PATTERN = re.compile(r"\b(visa sponsorship (?:available|provided|supported)|open to sponsorship)\b", re.IGNORECASE)


async def extract_job_profile(description_clean: str) -> ParsedJobProfile:
    """Extract structured qualifications from clean JD text."""
    # 1. Attempt frontier LLM structured extraction
    messages = [
        {"role": "system", "content": PROMPT_JD_EXTRACTION},
        {"role": "user", "content": f"<job_description>\n{description_clean}\n</job_description>"},
    ]
    parsed_llm = await complete(TaskKind.EXTRACTION, messages, ParsedJobProfile)
    if parsed_llm and isinstance(parsed_llm, ParsedJobProfile):
        return parsed_llm

    # 2. Heuristic fallback (works offline / zero cost / zero key)
    text_lower = description_clean.lower()

    # Extract years
    min_years = None
    y_match = YEARS_PATTERN.search(description_clean)
    if y_match:
        try:
            min_years = float(y_match.group(1))
        except Exception:
            pass

    # Extract seniority
    seniority = None
    s_match = SENIORITY_PATTERN.search(description_clean)
    if s_match:
        seniority = s_match.group(1).lower()

    # Extract skills
    found_skills: List[str] = []
    for skill in COMMON_TECH_SKILLS:
        if re.search(r"\b" + re.escape(skill) + r"\b", description_clean, re.IGNORECASE):
            found_skills.append(skill)

    # Visa
    visa_stmt = "unknown"
    if VISA_NO_PATTERN.search(text_lower):
        visa_stmt = "not_supported"
    elif VISA_YES_PATTERN.search(text_lower):
        visa_stmt = "supported"

    return ParsedJobProfile(
        seniority_level=seniority,
        min_years_experience=min_years,
        required_hard_skills=found_skills[:8],
        preferred_hard_skills=found_skills[8:12],
        soft_skills=["Communication", "Collaboration"],
        core_responsibilities=[],
        domain_keywords=[],
        education_minimum="Bachelor's Degree",
        work_location_type="remote" if "remote" in text_lower else "unknown",
        allowed_locations=["US"],
        visa_sponsorship_statement=visa_stmt,
        salary_range=None,
        summary_mission=description_clean[:300] if description_clean else None,
    )
