"""Tests for Milestone 5 (LinkedIn lane, Ashby adapter, Gated Autonomous mode, CAPTCHA)."""

from pathlib import Path
import pytest
from playwright.async_api import Page

from app.applier.adapters.ashby import AshbyAdapter
from app.applier.adapters.linkedin import LinkedInAdapter
from app.applier.captcha import detect_captcha
from app.config import get_settings
from app.errors import AppException
from app.schemas.profile import CandidateProfileOut, SkillOut


@pytest.fixture
def dummy_profile() -> CandidateProfileOut:
    return CandidateProfileOut(
        id="cand-test",
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


@pytest.mark.asyncio
async def test_linkedin_adapter_refuses_without_opt_in(dummy_profile):
    """LinkedIn adapter MUST refuse to run unless linkedin_opt_in=True."""
    settings = get_settings()
    settings.linkedin_opt_in = False

    adapter = LinkedInAdapter()
    dummy_pdf = Path("data/resumes/default.pdf")

    # Mock page object
    class FakePage:
        pass

    with pytest.raises(AppException) as exc_info:
        await adapter.fill_and_submit(
            page=FakePage(),  # type: ignore
            profile=dummy_profile,
            resume_pdf_path=dummy_pdf,
        )

    assert exc_info.value.code == "LINKEDIN_NOT_OPTED_IN"


def test_ashby_adapter_detection():
    adapter = AshbyAdapter()
    assert adapter.can_handle("https://jobs.ashbyhq.com/company/role-123")
    assert not adapter.can_handle("https://boards.greenhouse.io/company/jobs/456")


@pytest.mark.asyncio
async def test_captcha_detection():
    """Verify CAPTCHA selector detection."""
    # We can test the helper logic with a mock locator
    class MockLocator:
        def __init__(self, visible: bool):
            self._visible = visible
        async def count(self):
            return 1 if self._visible else 0
        @property
        def first(self):
            return self
        async def is_visible(self):
            return self._visible

    class MockPage:
        def locator(self, sel):
            if "recaptcha" in sel:
                return MockLocator(True)
            return MockLocator(False)

    has_captcha = await detect_captcha(MockPage())  # type: ignore
    assert has_captcha is True
