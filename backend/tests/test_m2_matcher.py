"""Unit tests for Matcher, Scoring, Extraction, and Backups (Milestone 2)."""

import pytest
from app.crawler.sources.jobspy_worker import JobSpyWorker
from app.db_backup import create_backup
from app.matcher.extract import extract_job_profile
from app.matcher.score import compute_match_score
from app.schemas.job import ParsedJobProfile
from app.schemas.profile import CandidateProfileOut, SkillOut, WorkExperienceOut


@pytest.mark.asyncio
async def test_extract_job_profile_heuristic():
    jd = """
    We are looking for a Senior Backend Engineer with 5+ years of experience.
    Must have strong skills in Python, FastAPI, Docker, and PostgreSQL.
    Experience with Redis and AWS is a plus.
    US Citizen only - no visa sponsorship provided.
    """
    parsed = await extract_job_profile(jd)
    assert parsed.seniority_level == "senior"
    assert parsed.min_years_experience == 5.0
    assert "Python" in parsed.required_hard_skills
    assert "FastAPI" in parsed.required_hard_skills
    assert parsed.visa_sponsorship_statement == "not_supported"


def test_score_hard_gate_visa():
    parsed = ParsedJobProfile(
        min_years_experience=3.0,
        required_hard_skills=["Python"],
        visa_sponsorship_statement="not_supported",
    )
    profile = CandidateProfileOut(
        id="cand-1",
        full_name="Candidate",
        email="c@example.com",
        phone="555",
        city="NYC",
        state="NY",
        country="US",
        work_authorization="H1B",
        requires_sponsorship=True,
        requires_future_sponsorship=True,
        notice_period_weeks=2,
        willing_to_relocate=False,
        summary_baseline="",
        skills=[SkillOut(id="s1", canonical_name="Python", proficiency="expert", years_of_experience=5.0, last_used_year=2026)],
    )

    breakdown = compute_match_score(parsed, profile)
    assert breakdown.hard_gate.passed is False
    assert "visa_sponsorship_not_supported" in breakdown.hard_gate.reasons
    assert breakdown.final == 0.0


def test_score_seniority_gap_gate():
    parsed = ParsedJobProfile(
        min_years_experience=8.0,
        required_hard_skills=["Python"],
    )
    profile = CandidateProfileOut(
        id="cand-2",
        full_name="Junior Dev",
        email="j@example.com",
        phone="555",
        city="NYC",
        state="NY",
        country="US",
        work_authorization="US Citizen",
        requires_sponsorship=False,
        requires_future_sponsorship=False,
        notice_period_weeks=2,
        willing_to_relocate=False,
        summary_baseline="",
        skills=[SkillOut(id="s2", canonical_name="Python", proficiency="intermediate", years_of_experience=2.0, last_used_year=2026)],
    )

    breakdown = compute_match_score(parsed, profile)
    assert breakdown.hard_gate.passed is False
    assert any("seniority_gap" in r for r in breakdown.hard_gate.reasons)
    assert breakdown.final == 0.0


def test_score_high_match_calculation():
    parsed = ParsedJobProfile(
        min_years_experience=3.0,
        required_hard_skills=["Python", "FastAPI"],
        preferred_hard_skills=["PostgreSQL"],
    )
    profile = CandidateProfileOut(
        id="cand-3",
        full_name="Senior Dev",
        email="s@example.com",
        phone="555",
        city="NYC",
        state="NY",
        country="US",
        work_authorization="US Citizen",
        requires_sponsorship=False,
        requires_future_sponsorship=False,
        notice_period_weeks=2,
        willing_to_relocate=False,
        summary_baseline="",
        skills=[
            SkillOut(id="s3", canonical_name="Python", proficiency="expert", years_of_experience=4.0, last_used_year=2026),
            SkillOut(id="s4", canonical_name="FastAPI", proficiency="expert", years_of_experience=4.0, last_used_year=2026),
            SkillOut(id="s5", canonical_name="PostgreSQL", proficiency="advanced", years_of_experience=3.0, last_used_year=2026),
        ],
    )

    breakdown = compute_match_score(parsed, profile)
    assert breakdown.hard_gate.passed is True
    assert breakdown.components.s_req == 1.0
    assert breakdown.components.s_pref == 1.0
    assert breakdown.final >= 80.0


def test_circuit_breaker():
    JobSpyWorker.record_success()
    assert JobSpyWorker.is_available() is True
    JobSpyWorker.record_failure()
    JobSpyWorker.record_failure()
    assert JobSpyWorker.is_available() is True
    JobSpyWorker.record_failure()  # 3rd failure
    assert JobSpyWorker.is_available() is False
    JobSpyWorker.record_success()  # Reset
    assert JobSpyWorker.is_available() is True


def test_db_backup(db_session):
    backup_path = create_backup(db_session, prefix="test_backup")
    assert backup_path.is_file()
    assert backup_path.stat().st_size > 0
    backup_path.unlink(missing_ok=True)
