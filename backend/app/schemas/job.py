"""Canonical Job Schema and API models for JobSeeker.

Defines the standard data contract across Discovery, Matching, Submission, and REST endpoints.
Keep in parity with core/models/job.py.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


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
    EASY_APPLY = "easy_apply"
    ATS_DIRECT = "ats_direct"
    EXTERNAL_FORM = "external_form"
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
    """Canonical lifecycle — keep in sync with ARCHITECTURE_PLAN.md §5 and DDL."""
    DISCOVERED = "discovered"
    FILTERED_OUT = "filtered_out"
    SCORE_QUEUED = "score_queued"
    SCORED = "scored"
    SKIPPED = "skipped"
    TAILORING = "tailoring"
    READY_TO_APPLY = "ready_to_apply"
    APPLYING = "applying"
    APPLIED = "applied"
    FAILED = "failed"
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
    """Canonical Job Record in the Auto-Job/JobSeeker platform."""
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


# --- REST API Schemas (§7.2) ---

class JobListItem(BaseModel):
    id: str
    title: str
    company: str
    company_logo_url: Optional[str] = None
    location: str
    workplace_type: str = "unknown"
    source: str
    ats_provider: str
    application_type: str
    match_score: Optional[float] = None
    status: str
    salary: Optional[SalaryInfo] = None
    date_posted: Optional[datetime] = None
    date_discovered: datetime


class JobPage(BaseModel):
    items: List[JobListItem]
    total: int
    page: int
    page_size: int


class HardGateDetail(BaseModel):
    passed: bool
    reasons: List[str] = Field(default_factory=list)


class ScoreComponents(BaseModel):
    s_req: float = 0.0
    s_pref: float = 0.0
    s_vec: float = 0.0
    s_llm: float = 0.0
    s_exp: float = 0.0


class ScoreBreakdown(BaseModel):
    final: float
    hard_gate: HardGateDetail
    components: ScoreComponents
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    degraded: bool = False


class TailoredArtifactSummary(BaseModel):
    resume_pdf_url: str
    cover_letter_txt: Optional[str] = None
    cover_letter_pdf_url: Optional[str] = None
    fact_check_status: str
    created_at: datetime


class ParsedJobProfile(BaseModel):
    seniority_level: Optional[str] = None
    min_years_experience: Optional[float] = None
    required_hard_skills: List[str] = Field(default_factory=list)
    preferred_hard_skills: List[str] = Field(default_factory=list)
    soft_skills: List[str] = Field(default_factory=list)
    core_responsibilities: List[str] = Field(default_factory=list)
    domain_keywords: List[str] = Field(default_factory=list)
    education_minimum: Optional[str] = None
    work_location_type: Optional[str] = None
    allowed_locations: List[str] = Field(default_factory=list)
    visa_sponsorship_statement: str = "unknown"  # supported | not_supported | unknown
    salary_range: Optional[str] = None
    summary_mission: Optional[str] = None


class JobDetail(JobListItem):
    description_clean: str
    parsed: Optional[ParsedJobProfile] = None
    score_breakdown: Optional[ScoreBreakdown] = None
    tailored: Optional[TailoredArtifactSummary] = None


class JobActionRequest(BaseModel):
    action: str  # approve | skip | archive | tailor
    reason: Optional[str] = None


class JobActionResponse(BaseModel):
    id: str
    status: str


class JobCrawlRequest(BaseModel):
    sources: Optional[List[str]] = None


class JobCrawlResponse(BaseModel):
    started: bool = True
    sweep_id: str


class JobSourceItem(BaseModel):
    company: str
    providers: List[str] = Field(default_factory=list)
    enabled: bool = True


class JobSourceCreate(BaseModel):
    company: str
    greenhouse_token: Optional[str] = None
    lever: Optional[str] = None
    ashby: Optional[str] = None
    workday: Optional[str] = None
