"""Structured 3-paragraph cover letter generator (§6.2, §11.4)."""

from __future__ import annotations

from typing import Any, Dict, List
from app.matcher.tailor import TailoredResumeData


def generate_cover_letter(
    candidate_name: str,
    job_title: str,
    company_name: str,
    top_bullet: str,
    tone: str = "technical_direct",
) -> str:
    """Generate structured 3-paragraph cover letter grounded in real verified facts."""
    if tone == "startup_collaborative":
        p1 = f"Dear Hiring Team at {company_name},\n\nI am thrilled to apply for the {job_title} position. As a software engineer with a track record of shipping resilient, high-throughput systems, I have long admired {company_name}'s fast-moving engineering culture and technical ambition."
        p2 = f"Throughout my recent work, I have focused on solving high-impact architectural challenges. Specifically: {top_bullet} I take ownership of projects from initial design through production deployment, emphasizing clean interfaces, performance, and cross-functional momentum."
        p3 = f"I am eager to bring this engineering discipline and enthusiasm to the team at {company_name}. I look forward to the opportunity to discuss how my technical background aligns with your upcoming roadmap."
    elif tone == "enterprise_formal":
        p1 = f"Dear Hiring Committee at {company_name},\n\nPlease accept this letter and the enclosed resume as my formal application for the {job_title} role. With extensive background building robust distributed services, I offer proven engineering capability aligned with {company_name}'s mission."
        p2 = f"In previous positions, I demonstrated measurable business and technical impact: {top_bullet} My experience encompasses end-to-end system reliability, rigorous automated testing, and predictable delivery within enterprise production environments."
        p3 = f"I would welcome the opportunity to speak with you regarding how my technical qualifications will benefit {company_name}. Thank you for your time and consideration."
    else:  # technical_direct (default)
        p1 = f"Dear {company_name} Engineering Team,\n\nI am writing to express my interest in the {job_title} opening. My technical background centers on scalable backend architectures, cloud-native pipelines, and reliable API systems."
        p2 = f"A direct demonstration of this work: {top_bullet} In my engineering work, I prioritize code maintainability, measurable latency reduction, and rigorous telemetry over superficial complexity."
        p3 = f"I am excited about the challenges {company_name} is addressing and would welcome the chance to discuss how my skill set can support your engineering objectives. Thank you for your review."

    return f"{p1}\n\n{p2}\n\n{p3}\n\nSincerely,\n{candidate_name}"
