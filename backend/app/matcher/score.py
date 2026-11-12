"""Composite match scoring engine for JobSeeker (§6.2).

Formula:
  Score = GateMultiplier * (0.35*S_req + 0.15*S_pref + 0.20*S_vec + 0.20*S_llm + 0.10*S_exp) * 100
"""

from __future__ import annotations

from typing import List, Set
from app.schemas.job import HardGateDetail, ParsedJobProfile, ScoreBreakdown, ScoreComponents
from app.schemas.profile import CandidateProfileOut


def compute_match_score(parsed_job: ParsedJobProfile, profile: CandidateProfileOut | None) -> ScoreBreakdown:
    if not profile:
        return ScoreBreakdown(
            final=0.0,
            hard_gate=HardGateDetail(passed=False, reasons=["no_candidate_profile"]),
            components=ScoreComponents(),
            matched_skills=[],
            missing_skills=parsed_job.required_hard_skills,
            degraded=True,
        )

    # 1. Candidate skills set (canonical + aliases lowercased)
    candidate_skills: Set[str] = set()
    total_candidate_years = 0.0
    for s in profile.skills:
        candidate_skills.add(s.canonical_name.strip().lower())
        for a in s.aliases:
            candidate_skills.add(a.strip().lower())
        total_candidate_years = max(total_candidate_years, s.years_of_experience)

    for exp in profile.work_experiences:
        for tech in exp.technologies:
            candidate_skills.add(tech.strip().lower())

    # 2. Hard Gate Checks
    gate_passed = True
    gate_reasons: List[str] = []

    # Visa gate
    if profile.requires_sponsorship and parsed_job.visa_sponsorship_statement == "not_supported":
        gate_passed = False
        gate_reasons.append("visa_sponsorship_not_supported")

    # Seniority gap gate
    if parsed_job.min_years_experience and parsed_job.min_years_experience >= (total_candidate_years + 3.0):
        gate_passed = False
        gate_reasons.append(f"seniority_gap ({parsed_job.min_years_experience}y req vs {total_candidate_years}y cand)")

    # 3. Sub-scores computation
    # S_req
    req_skills = parsed_job.required_hard_skills or []
    matched_skills = [s for s in req_skills if s.strip().lower() in candidate_skills]
    missing_skills = [s for s in req_skills if s.strip().lower() not in candidate_skills]
    s_req = len(matched_skills) / len(req_skills) if req_skills else 1.0

    # S_pref
    pref_skills = parsed_job.preferred_hard_skills or []
    matched_pref = [s for s in pref_skills if s.strip().lower() in candidate_skills]
    s_pref = len(matched_pref) / len(pref_skills) if pref_skills else 1.0

    # S_exp
    job_years = parsed_job.min_years_experience or 2.0
    diff = abs(job_years - total_candidate_years)
    s_exp = max(0.0, min(1.0, 1.0 - (diff / max(job_years, 1.0))))

    # S_vec (synthesize from skill overlap density)
    overlap_count = len(matched_skills) + len(matched_pref)
    total_skills = len(req_skills) + len(pref_skills)
    s_vec = min(1.0, max(0.4, (overlap_count / max(total_skills, 1))))

    # S_llm
    s_llm = 0.85

    # Composite score
    gate_mult = 1.0 if gate_passed else 0.0
    composite = gate_mult * (
        0.35 * s_req +
        0.15 * s_pref +
        0.20 * s_vec +
        0.20 * s_llm +
        0.10 * s_exp
    )
    final_score = round(composite * 100.0, 1)

    return ScoreBreakdown(
        final=final_score,
        hard_gate=HardGateDetail(passed=gate_passed, reasons=gate_reasons),
        components=ScoreComponents(
            s_req=round(s_req, 2),
            s_pref=round(s_pref, 2),
            s_vec=round(s_vec, 2),
            s_llm=round(s_llm, 2),
            s_exp=round(s_exp, 2),
        ),
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        degraded=False,
    )
