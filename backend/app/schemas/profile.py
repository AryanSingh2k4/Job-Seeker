"""Profile schemas for JobSeeker.

Matches candidate master profile, skills, experiences, education, projects,
certifications, import draft/confirm, and QA knowledge base (§7.1).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SkillBase(BaseModel):
    canonical_name: str
    category: str = "technical"
    proficiency: str = "advanced"  # beginner | intermediate | advanced | expert
    years_of_experience: float = 1.0
    last_used_year: int = 2026
    aliases: List[str] = Field(default_factory=list)


class SkillIn(SkillBase):
    pass


class SkillOut(SkillBase):
    id: str
    candidate_id: Optional[str] = None


class BulletBase(BaseModel):
    raw_text: str
    action_verb: str = ""
    skills_used: List[str] = Field(default_factory=list)
    metrics_quantified: List[str] = Field(default_factory=list)
    domain_tags: List[str] = Field(default_factory=list)
    verified: bool = False
    priority_score: float = 1.0


class BulletIn(BulletBase):
    pass


class BulletOut(BulletBase):
    id: str
    experience_id: Optional[str] = None
    project_id: Optional[str] = None


class WorkExperienceBase(BaseModel):
    company_name: str
    company_url: Optional[str] = None
    role_title: str
    location: str
    location_type: str = "remote"  # remote | hybrid | onsite
    start_date: str  # YYYY-MM
    end_date: Optional[str] = None
    is_current: bool = False
    technologies: List[str] = Field(default_factory=list)


class WorkExperienceIn(WorkExperienceBase):
    bullets: List[BulletIn] = Field(default_factory=list)


class WorkExperienceOut(WorkExperienceBase):
    id: str
    candidate_id: Optional[str] = None
    bullets: List[BulletOut] = Field(default_factory=list)


class EducationBase(BaseModel):
    institution: str
    degree: str
    field_of_study: str
    start_year: int
    end_year: Optional[int] = None
    gpa: Optional[float] = None
    honors: List[str] = Field(default_factory=list)


class EducationIn(EducationBase):
    pass


class EducationOut(EducationBase):
    id: str
    candidate_id: Optional[str] = None


class ProjectBase(BaseModel):
    name: str
    description: str
    url: Optional[str] = None
    technologies: List[str] = Field(default_factory=list)
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class ProjectIn(ProjectBase):
    bullets: List[BulletIn] = Field(default_factory=list)


class ProjectOut(ProjectBase):
    id: str
    candidate_id: Optional[str] = None
    bullets: List[BulletOut] = Field(default_factory=list)


class CertificationBase(BaseModel):
    name: str
    issuing_organization: str
    issue_date: str
    expiration_date: Optional[str] = None
    credential_id: Optional[str] = None
    credential_url: Optional[str] = None


class CertificationIn(CertificationBase):
    pass


class CertificationOut(CertificationBase):
    id: str
    candidate_id: Optional[str] = None


class QAKnowledgeItem(BaseModel):
    id: Optional[str] = None
    category: str
    question_canonical: str
    question_patterns: List[str] = Field(default_factory=list)
    answer_value: str
    answer_type: str = "text"
    source: str = "USER_VERIFIED"  # USER_VERIFIED | LLM_CACHED
    confidence_score: float = 1.0


class CandidateProfileIn(BaseModel):
    full_name: str
    email: str
    phone: str
    city: str
    state: str
    country: str = "US"
    postal_code: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    citizenship: List[str] = Field(default_factory=lambda: ["US"])
    work_authorization: str = "US Citizen"
    requires_sponsorship: bool = False
    requires_future_sponsorship: bool = False
    target_salary_min: Optional[int] = None
    target_salary_desired: Optional[int] = None
    notice_period_weeks: int = 2
    willing_to_relocate: bool = False
    summary_baseline: str = ""
    target_preferences: Dict[str, Any] = Field(default_factory=dict)

    skills: List[SkillIn] = Field(default_factory=list)
    work_experiences: List[WorkExperienceIn] = Field(default_factory=list)
    education: List[EducationIn] = Field(default_factory=list)
    projects: List[ProjectIn] = Field(default_factory=list)
    certifications: List[CertificationIn] = Field(default_factory=list)


class CandidateProfileOut(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str
    city: str
    state: str
    country: str
    postal_code: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    citizenship: List[str] = Field(default_factory=list)
    work_authorization: str
    requires_sponsorship: bool
    requires_future_sponsorship: bool
    target_salary_min: Optional[int] = None
    target_salary_desired: Optional[int] = None
    notice_period_weeks: int
    willing_to_relocate: bool
    summary_baseline: str
    target_preferences: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    skills: List[SkillOut] = Field(default_factory=list)
    work_experiences: List[WorkExperienceOut] = Field(default_factory=list)
    education: List[EducationOut] = Field(default_factory=list)
    projects: List[ProjectOut] = Field(default_factory=list)
    certifications: List[CertificationOut] = Field(default_factory=list)
    qa: List[QAKnowledgeItem] = Field(default_factory=list)


class ResumeImportDraftOut(BaseModel):
    draft_id: str
    draft: Dict[str, Any]


class ResumeImportConfirmIn(BaseModel):
    draft_id: str
    accepted: Dict[str, List[str]] = Field(default_factory=dict)
    edits: Optional[Dict[str, Any]] = None
