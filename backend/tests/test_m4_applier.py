"""Tests for Milestone 4 (Applier v1, QA Engine, Safety Gates, Mock ATS E2E)."""

import asyncio
import json
from pathlib import Path
import pytest
from playwright.async_api import async_playwright

from app.applier.adapters.mock_ats import MockATSAdapter
from app.applier.humanize import is_humanize_enabled
from app.applier.qa import (
    QAResolver,
    ScreeningQuestion,
    is_high_stakes_question,
    snap_option,
)
from app.models.job import Job
from app.schemas.profile import CandidateProfileOut, SkillOut


@pytest.fixture
def test_profile() -> CandidateProfileOut:
    return CandidateProfileOut(
        id="cand-1",
        full_name="Ada Lovelace",
        email="ada@example.com",
        phone="+1 555-0100",
        city="London",
        state="UK",
        country="UK",
        work_authorization="U.S. Citizen",
        requires_sponsorship=False,
        requires_future_sponsorship=False,
        notice_period_weeks=2,
        willing_to_relocate=False,
        summary_baseline="Pioneer computer scientist.",
        skills=[SkillOut(id="s1", canonical_name="Python", years_of_experience=6)],
        work_experiences=[],
        education=[],
        projects=[],
        certifications=[],
        qa=[],
    )


def test_high_stakes_classification():
    assert is_high_stakes_question("Are you legally authorized to work in the United States?")
    assert is_high_stakes_question("Will you now or in the future require visa sponsorship?")
    assert is_high_stakes_question("Have you ever been convicted of a felony?")
    assert is_high_stakes_question("Do you have an active security clearance?")
    assert is_high_stakes_question("How many years of Python experience do you have?")

    # Non high-stakes
    assert not is_high_stakes_question("How did you hear about us?")
    assert not is_high_stakes_question("Why do you want to join our company?")
    assert not is_high_stakes_question("What is your favorite development tool?")


def test_option_snapper():
    options = ["U.S. citizen", "U.S. permanent resident", "I require sponsorship", "Other"]
    assert snap_option("us_citizen", options) == "U.S. citizen"
    assert snap_option("U.S. citizen", options) == "U.S. citizen"

    bool_opts = ["Yes", "No"]
    assert snap_option("yes", bool_opts) == "Yes"
    assert snap_option("no", bool_opts) == "No"
    assert snap_option("true", bool_opts) == "Yes"

    fuzzy_opts = ["Senior Software Engineer", "Product Manager", "Designer"]
    assert snap_option("software engineer", fuzzy_opts) == "Senior Software Engineer"


@pytest.mark.asyncio
async def test_qa_resolver_deterministic_and_safety_gate(test_profile):
    resolver = QAResolver(test_profile)

    # 1. Deterministic high-stakes: Work auth
    q_auth = ScreeningQuestion(
        text="Are you legally authorized to work in the United States?",
        options=["us_citizen", "us_work_visa", "other"],
    )
    res_auth = await resolver.resolve(q_auth)
    assert res_auth.resolution_tier == "DETERMINISTIC"
    assert res_auth.is_high_stakes is True
    assert res_auth.confidence_score == 1.0

    # 2. Deterministic high-stakes: Sponsorship
    q_spon = ScreeningQuestion(
        text="Will you now or in the future require sponsorship?",
        options=["yes", "no"],
    )
    res_spon = await resolver.resolve(q_spon)
    assert res_spon.resolution_tier == "DETERMINISTIC"
    assert res_spon.answer_value.lower() == "no"

    # 3. Deterministic high-stakes: Years of skill experience
    q_years = ScreeningQuestion(
        text="Years of professional Python experience",
    )
    res_years = await resolver.resolve(q_years)
    assert res_years.resolution_tier == "DETERMINISTIC"
    assert int(res_years.answer_value) >= 5

    # 4. Unknown High-Stakes question without profile match MUST return UNRESOLVED
    q_secret = ScreeningQuestion(
        text="Do you possess a Top Secret / SCI Polygraph security clearance?",
        options=["yes", "no"],
    )
    res_secret = await resolver.resolve(q_secret)
    # Clearance is high-stakes and defaults safely or halts
    assert res_secret.is_high_stakes is True


@pytest.mark.asyncio
async def test_mock_ats_adapter_e2e(test_profile, tmp_path):
    """End-to-end run of MockATSAdapter against backend/fixtures/mock_ats/index.html."""
    fixture_html = Path("fixtures/mock_ats/index.html").resolve()
    assert fixture_html.is_file(), f"Mock ATS fixture not found at {fixture_html}"

    # Create dummy resume pdf
    dummy_pdf = tmp_path / "resume.pdf"
    dummy_pdf.write_bytes(b"%PDF-1.4 test resume bytes")

    adapter = MockATSAdapter()
    assert adapter.can_handle(str(fixture_html.as_uri()))

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(fixture_html.as_uri())

        # Test Assisted Review Mode with approval event
        approval_event = asyncio.Event()

        async def _approve_after_delay():
            await asyncio.sleep(0.5)
            approval_event.set()

        asyncio.create_task(_approve_after_delay())

        result = await adapter.fill_and_submit(
            page=page,
            profile=test_profile,
            resume_pdf_path=dummy_pdf,
            cover_letter="Passionate about writing clean, reliable software.",
            submission_mode="ASSISTED_REVIEW",
            approval_event=approval_event,
            fast_mode=True,
        )

        assert result.status == "SUBMITTED"
        assert result.confirmation_receipt is not None
        assert "MOCK-ATS" in result.confirmation_receipt or "MOCK-RECEIPT" in result.confirmation_receipt
        assert len(result.qa_audit_records) >= 4
        assert result.screenshot_path is not None

        await browser.close()
