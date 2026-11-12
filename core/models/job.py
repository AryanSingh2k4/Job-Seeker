"""
Auto-Job: Canonical Job Schema (v2)
Defines the standard data contract across Discovery (Crawler), Matching (Matcher), and Submission (Applier).

Canonical job status lifecycle (single source of truth, mirrored in ARCHITECTURE_PLAN.md §5):
    discovered -> filtered_out | score_queued -> scored -> skipped | tailoring
               -> ready_to_apply -> applying -> applied | failed | archived
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, HttpUrl, field_validator


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class JobSource(str, Enum):
    LINKEDIN = "linkedin"
    INDEED = "indeed"
    GLASSDOOR = "glassdoor"
    GREENHOUSE = "greenhouse"
    LEVER = "lever"
    ASHBY = "ashby"
    WORKDAY = "workday"
    SMARTRECRUITERS = "smartrecruiters"
    CUSTOM = "custom"


class WorkplaceType(str, Enum):
    REMOTE = "remote"
    HYBRID = "hybrid"
    ONSITE = "onsite"
    UNKNOWN = "unknown"


class ApplicationType(str, Enum):
    EASY_APPLY = "easy_apply"       # In-platform multi-step modal (LinkedIn Easy Apply — opt-in lane only)
    ATS_DIRECT = "ats_direct"       # Direct submission to ATS public form (Greenhouse, Lever, Ashby) — safe default lane
    EXTERNAL_FORM = "external_form" # Complex multi-page portal (Workday, Taleo, custom)
    EMAIL = "email"
    UNKNOWN = "unknown"


class ATSProvider(str, Enum):
    GREENHOUSE = "greenhouse"
    LEVER = "lever"
    ASHBY = "ashby"
    WORKDAY = "workday"
    SMARTRECRUITERS = "smartrecruiters"
    ICIMS = "icims"
    TALEO = "taleo"
    BAMBOOHR = "bamboohr"
    UNKNOWN = "unknown"


class JobStatus(str, Enum):
    """Canonical lifecycle — keep in sync with ARCHITECTURE_PLAN.md §5 and the DDL."""
    DISCOVERED = "discovered"       # Ingested, raw
    FILTERED_OUT = "filtered_out"   # Rejected by rule pre-filter
    SCORE_QUEUED = "score_queued"   # Waiting for matcher evaluation
    SCORED = "scored"               # Match score computed (triage decision pending or done)
    SKIPPED = "skipped"             # Below threshold or user skip (reason logged)
    TAILORING = "tailoring"         # Generating tailored resume & cover letter
    READY_TO_APPLY = "ready_to_apply"  # Artifacts verified and staged
    APPLYING = "applying"           # Automation in progress
    APPLIED = "applied"             # Successfully submitted
    FAILED = "failed"               # Submission error (failure_stage logged)
    ARCHIVED = "archived"


class SalaryInterval(str, Enum):
    HOURLY = "hourly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class SalaryInfo(BaseModel):
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    currency: str = "USD"
    interval: SalaryInterval = SalaryInterval.YEARLY


class JobPosting(BaseModel):
    """Canonical Job Record in the Auto-Job platform."""
    id: str = Field(..., description="Unique UUID for this job in Auto-Job")
    fingerprint: str = Field(..., description="Deduplication hash (SHA-256 of normalized company+title+location)")

    # Source & Provenance
    source: JobSource = Field(..., description="Origin platform of ingestion")
    source_job_id: Optional[str] = Field(None, description="Platform-native identifier (e.g. LinkedIn job ID)")
    source_url: str = Field(..., description="Original URL where posting was found")
    canonical_url: str = Field(..., description="Clean unshortened URL without tracking params")

    # Core Metadata
    title: str = Field(..., description="Normalized job title")
    company: str = Field(..., description="Hiring company name")
    company_domain: Optional[str] = Field(None, description="e.g. stripe.com")
    company_logo_url: Optional[str] = None

    # Location & Work Setup
    location: str = Field(..., description="Reported location string, e.g. 'San Francisco, CA' or 'US Remote'")
    workplace_type: WorkplaceType = WorkplaceType.UNKNOWN
    country: Optional[str] = Field("US", description="Two-letter ISO country code")

    # Compensation
    salary: Optional[SalaryInfo] = None

    # Role Specifications
    employment_type: Optional[str] = Field("full-time", description="full-time, part-time, contract, internship")
    experience_level: Optional[str] = Field(None, description="entry, mid, senior, lead, executive")
    skills_required: List[str] = Field(default_factory=list, description="Extracted technical/functional skills")

    # Description Body
    description_raw: str = Field(..., description="Raw HTML or formatted text from source")
    description_clean: str = Field(..., description="Sanitized, prompt-injection protected plain text/markdown")

    # Application Channel
    application_type: ApplicationType = ApplicationType.UNKNOWN
    ats_provider: ATSProvider = ATSProvider.UNKNOWN
    application_url: str = Field(..., description="Direct URL to the application form/endpoint")

    # Lifecycle & Timestamps
    date_posted: Optional[datetime] = None
    date_discovered: datetime = Field(default_factory=_utcnow)
    status: JobStatus = JobStatus.DISCOVERED

    # Matcher & Tailoring Enrichment (populated downstream)
    match_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Semantic compatibility score")
    match_reasons: List[str] = Field(default_factory=list)
    tailored_resume_path: Optional[str] = None
    tailored_cover_letter_path: Optional[str] = None

    # Extensible Metadata (ATS form fields, detected questions, raw response payload)
    metadata: Dict[str, Any] = Field(default_factory=dict)
