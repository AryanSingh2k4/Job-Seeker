"""High-coverage unit tests for crawler, matcher, and QA engine to exceed 90% coverage."""

import asyncio
from pathlib import Path
import pytest

from app.applier.qa import (
    HIGH_STAKES_PATTERNS,
    QAResolution,
    QAResolver,
    ScreeningQuestion,
    is_high_stakes_question,
    snap_option,
)
from app.crawler.models import RawJobPosting
from app.crawler.pipeline.canonicalize import canonicalize_url, detect_ats_provider
from app.crawler.pipeline.dedup import check_duplicate
from app.crawler.pipeline.fingerprint import compute_semantic_fingerprint, compute_url_fingerprint
from app.crawler.pipeline.prefilter import run_prefilter
from app.crawler.pipeline.sanitize import sanitize_job_description, wrap_for_llm
from app.crawler.registry import load_registry_seed
from app.matcher.cover_letter import generate_cover_letter
from app.matcher.extract import extract_job_profile
from app.schemas.job import ParsedJobProfile
from app.matcher.factcheck import (
    MetricTamperingException,
    extract_metrics,
    fact_check_resume,
    validate_tailored_bullet,
)
from app.matcher.score import compute_match_score
from app.matcher.tailor import TailoredResumeData, tailor_resume
from app.schemas.profile import BulletOut, CandidateProfileOut, SkillOut, WorkExperienceOut


@pytest.fixture
def sample_candidate() -> CandidateProfileOut:
    return CandidateProfileOut(
        id="cand-boost",
        full_name="Ada Augusta Lovelace",
        email="ada@example.com",
        phone="+1 555-0100",
        city="London",
        state="Greater London",
        country="UK",
        work_authorization="U.S. Work Visa (H-1B)",
        requires_sponsorship=True,
        requires_future_sponsorship=True,
        notice_period_weeks=4,
        willing_to_relocate=True,
        summary_baseline="Pioneer computer programmer and mathematician.",
        skills=[
            SkillOut(id="s1", canonical_name="Python", years_of_experience=7.0),
            SkillOut(id="s2", canonical_name="C++", years_of_experience=4.0),
        ],
        work_experiences=[
            WorkExperienceOut(
                id="w1",
                candidate_id="cand-boost",
                company_name="Babbage Labs",
                role_title="Lead Algorithm Engineer",
                location="London, UK",
                start_date="1842-01",
                end_date="1843-12",
                is_current=False,
                bullets=[
                    BulletOut(
                        id="b1",
                        raw_text="Engineered the first machine algorithm for the Analytical Engine, achieving 100% calculation accuracy.",
                        verified=True,
                    ),
                    BulletOut(
                        id="b2",
                        raw_text="Reduced computational cycle time by 45% using optimized loop sequences.",
                        verified=True,
                    ),
                ],
            )
        ],
        education=[],
        projects=[],
        certifications=[],
        qa=[],
    )


# ==============================================================================
# QA Engine Deep Coverage
# ==============================================================================
def test_snap_option_all_branches():
    assert snap_option("hello", []) == "hello"
    assert snap_option("false", ["Yes", "No"]) == "No"
    assert snap_option("0", ["True", "False"]) == "False"
    assert snap_option("random_val", ["foo", "bar"]) is None
    assert snap_option("US Citizen", ["us_citizen", "other"]) == "us_citizen"


@pytest.mark.asyncio
async def test_qa_resolver_all_question_types(sample_candidate):
    resolver = QAResolver(sample_candidate)

    # Visa auth branch
    q_visa = ScreeningQuestion(text="Are you legally authorized?", options=["us_work_visa", "other"])
    res = await resolver.resolve(q_visa)
    assert res.answer_value == "us_work_visa"

    # Sponsorship requires = True
    q_spon = ScreeningQuestion(text="Do you require visa sponsorship now or in the future?", options=["yes", "no"])
    res_spon = await resolver.resolve(q_spon)
    assert res_spon.answer_value.lower() == "yes"

    # Specific skill years lookup
    q_cpp = ScreeningQuestion(text="How many years of C++ experience do you have?")
    res_cpp = await resolver.resolve(q_cpp)
    assert res_cpp.answer_value == "4"

    # Generic total years
    q_tot = ScreeningQuestion(text="Total years of professional experience?")
    res_tot = await resolver.resolve(q_tot)
    assert int(res_tot.answer_value) >= 5

    # Relocation
    q_reloc = ScreeningQuestion(text="Are you willing to relocate for this position?")
    res_reloc = await resolver.resolve(q_reloc)
    assert res_reloc.answer_value == "yes"

    # Security clearance
    q_clear = ScreeningQuestion(text="Do you have an active security clearance?")
    res_clear = await resolver.resolve(q_clear)
    assert res_clear.answer_value == "no"

    # Sources / How did you hear
    q_web = ScreeningQuestion(text="How did you hear about us?", options=["Company website", "Other"])
    res_web = await resolver.resolve(q_web)
    assert res_web.answer_value == "Company website"

    q_li = ScreeningQuestion(text="Referral source?", options=["LinkedIn", "Referral"])
    res_li = await resolver.resolve(q_li)
    assert res_li.answer_value == "LinkedIn"

    q_jb = ScreeningQuestion(text="Source of application?", options=["Job board", "Other"])
    res_jb = await resolver.resolve(q_jb)
    assert res_jb.answer_value == "Job board"

    # Checkboxes
    q_chk = ScreeningQuestion(text="I certify that information is accurate", field_type="checkbox")
    res_chk = await resolver.resolve(q_chk)
    assert res_chk.answer_value == "true"

    # Personal info
    q_fn = ScreeningQuestion(text="First name")
    assert (await resolver.resolve(q_fn)).answer_value == "Ada"

    q_ln = ScreeningQuestion(text="Last name")
    assert (await resolver.resolve(q_ln)).answer_value == "Lovelace"

    q_em = ScreeningQuestion(text="Email address")
    assert (await resolver.resolve(q_em)).answer_value == "ada@example.com"

    q_ph = ScreeningQuestion(text="Phone number")
    assert (await resolver.resolve(q_ph)).answer_value == "+1 555-0100"

    q_loc = ScreeningQuestion(text="Location / City")
    assert "London" in (await resolver.resolve(q_loc)).answer_value


# ==============================================================================
# Crawler Pipeline Deep Coverage
# ==============================================================================
def test_canonicalize_url_patterns():
    # Greenhouse
    gh_url = "https://boards.greenhouse.io/embed/job_app?for=datadog&token=12345&utm_source=linkedin"
    assert "token=12345" in canonicalize_url(gh_url)
    assert "utm_source" not in canonicalize_url(gh_url)
    assert detect_ats_provider(gh_url).lower() == "greenhouse"

    # Lever
    lever_url = "https://jobs.lever.co/spotify/abc-123/?utm_source=indeed#apply"
    assert "utm_source" not in canonicalize_url(lever_url)
    assert detect_ats_provider(lever_url).lower() == "lever"

    # Ashby
    ashby_url = "https://jobs.ashbyhq.com/linear/5678/apply?source=google"
    assert "source=google" not in canonicalize_url(ashby_url)
    assert detect_ats_provider(ashby_url).lower() == "ashby"

    # Unknown
    other_url = "https://example.com/careers/job?id=10"
    assert detect_ats_provider(other_url).lower() == "unknown"


def test_fingerprint_and_sanitization():
    raw_html = "<p>Clean text&#8203;with zero width<script>evil()</script><style>.bad{}</style></p>"
    clean = sanitize_job_description(raw_html)
    assert "<script>" not in clean
    assert "<style>" not in clean
    assert "zero width" in clean

    wrapped = wrap_for_llm(clean)
    assert "<job_description>" in wrapped

    sem_hash = compute_semantic_fingerprint("Stripe", "Senior Backend Engineer", "remote")
    assert len(sem_hash) == 64
    url_h = compute_url_fingerprint("https://example.com/job/1")
    assert len(url_h) == 64


def test_prefilter_all_rules():
    # Pass case
    passed, reason = run_prefilter(
        title="Senior Software Engineer",
        description_text="Python, distributed systems, API design.",
        workplace_type="remote",
        salary_max=180000,
    )
    assert passed is True

    # Title blacklist
    passed, reason = run_prefilter(
        title="Vice President of Engineering",
        description_text="Executive leadership role.",
        workplace_type="remote",
        salary_max=250000,
    )
    assert passed is False
    assert reason == "title_blacklisted"

    # Visa block
    passed, reason = run_prefilter(
        title="Senior Backend Engineer",
        description_text="U.S. Citizen only. Must have TS/SCI.",
        workplace_type="remote",
        salary_max=180000,
        candidate_profile={"requires_sponsorship": True},
    )
    assert passed is False
    assert reason == "visa_sponsorship_unavailable"


def test_company_registry_loading():
    companies = load_registry_seed()
    assert len(companies) > 0
    first = companies[0]
    assert "company" in first


# ==============================================================================
# Matcher & Tailor Deep Coverage
# ==============================================================================
def test_tailor_resume_and_factcheck(sample_candidate):
    jd_profile = ParsedJobProfile(
        required_hard_skills=["Python", "Distributed Systems", "Algorithms"],
        preferred_hard_skills=["C++", "Performance Tuning"],
        min_years_experience=5,
        visa_sponsorship_statement="supported",
    )

    tailored_data = tailor_resume(sample_candidate, "job-boost-1", jd_profile)
    assert tailored_data.full_name == sample_candidate.full_name
    assert len(tailored_data.experiences) >= 1
    assert len(tailored_data.experiences[0]["bullets"]) >= 1

    # Extract all bullets from sample candidate
    master_pool = {
        b.id: b.raw_text
        for exp in sample_candidate.work_experiences
        for b in exp.bullets
    }

    selected = [b for exp in tailored_data.experiences for b in exp["bullets"]]
    passed, reasons = fact_check_resume(selected, master_pool)
    assert passed is True

    # Validate metric tampering detection directly
    orig = "Reduced latency by 45% using caching."
    tampered = "Reduced latency by 99% using caching."
    passed, msg = validate_tailored_bullet(orig, orig)
    assert passed is True

    # Verbatim check
    passed, msg = validate_tailored_bullet(tampered, orig)
    assert passed is False


def test_cover_letter_all_tones(sample_candidate):
    tones = ["technical_direct", "startup_collaborative", "enterprise_formal"]
    for tone in tones:
        cl = generate_cover_letter(
            candidate_name=sample_candidate.full_name,
            job_title="Staff Backend Engineer",
            company_name="CloudScale",
            top_bullet="Reduced computational cycle time by 45% using optimized loop sequences.",
            tone=tone,
        )
        assert "Ada Augusta Lovelace" in cl
        assert "CloudScale" in cl
        assert len(cl.split("\n\n")) >= 3


def test_canonicalize_additional_providers():
    assert detect_ats_provider("https://acme.myworkdayjobs.com/en-US/careers/job/123").lower() == "workday"
    assert detect_ats_provider("https://jobs.smartrecruiters.com/Acme/456").lower() == "smartrecruiters"
    assert detect_ats_provider("https://careers-acme.icims.com/jobs/789").lower() == "icims"


@pytest.mark.asyncio
async def test_extract_job_profile_fallback():
    jd_text = """Senior Backend Engineer at Acme Corp.
    5+ years of experience with Python, FastAPI, and PostgreSQL required.
    Visa sponsorship available.
    """
    profile = await extract_job_profile(jd_text)
    assert profile.min_years_experience == 5.0
    assert "Python" in profile.required_hard_skills
    assert profile.visa_sponsorship_statement == "supported"


def test_compute_match_score_all_paths(sample_candidate):
    jd_profile = ParsedJobProfile(
        required_hard_skills=["Python", "C++"],
        preferred_hard_skills=["FastAPI"],
        min_years_experience=5.0,
        visa_sponsorship_statement="supported",
    )

    # 1. Successful match
    score = compute_match_score(jd_profile, sample_candidate)
    assert score.hard_gate.passed is True
    assert score.final > 60.0

    # 2. No candidate profile
    no_prof_score = compute_match_score(jd_profile, None)
    assert no_prof_score.hard_gate.passed is False
    assert no_prof_score.degraded is True

    # 3. Visa gate failure
    visa_fail_jd = ParsedJobProfile(
        required_hard_skills=["Python"],
        visa_sponsorship_statement="not_supported",
    )
    fail_score = compute_match_score(visa_fail_jd, sample_candidate)
    assert fail_score.hard_gate.passed is False
    assert fail_score.final == 0.0

    # 4. Seniority gap failure
    too_senior_jd = ParsedJobProfile(
        required_hard_skills=["Python"],
        min_years_experience=20.0,
        visa_sponsorship_statement="supported",
    )
    senior_fail = compute_match_score(too_senior_jd, sample_candidate)
    assert senior_fail.hard_gate.passed is False


@pytest.mark.asyncio
async def test_qa_additional_branches(sample_candidate):
    resolver = QAResolver(sample_candidate)

    # Work auth without options
    q_no_opt = ScreeningQuestion(text="Are you legally authorized to work in the US?")
    res_no_opt = await resolver.resolve(q_no_opt)
    assert res_no_opt.answer_value in ("Yes", "us_work_visa")

    # Unknown question falling back to LLM/Unresolved
    q_story = ScreeningQuestion(text="Tell us about a time you resolved a conflict.")
    res_story = await resolver.resolve(q_story)
    assert res_story.resolution_tier in ("UNRESOLVED", "LLM_GENERATED")

    # Test snap_option negative cases
    assert snap_option("no", ["Accept", "Decline"]) is None
    assert snap_option("maybe", ["Yes", "No"]) is None


def test_factcheck_unearned_bullet(sample_candidate):
    master_pool = {"b1": "Known verified bullet."}
    unearned = ["Completely fabricated bullet about AI scaling."]
    passed, reasons = fact_check_resume(unearned, master_pool)
    assert passed is False
    assert any("unearned_bullet" in r for r in reasons)
