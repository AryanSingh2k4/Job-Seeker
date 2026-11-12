import uuid

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    fingerprint = Column(String(64), nullable=False, unique=True)
    source = Column(String(40), nullable=False)
    source_job_id = Column(String(120), nullable=True)
    source_url = Column(Text, nullable=False)
    canonical_url = Column(Text, nullable=False)
    title = Column(String(160), nullable=False)
    company = Column(String(120), nullable=False)
    company_domain = Column(String(80), nullable=True)
    company_logo_url = Column(Text, nullable=True)
    location = Column(String(120), nullable=False)
    workplace_type = Column(String(20), nullable=False, default="unknown")
    country = Column(String(10), nullable=True)
    salary_info = Column(Text, nullable=True)
    employment_type = Column(String(40), nullable=True)
    experience_level = Column(String(40), nullable=True)
    skills_required = Column(JSON, nullable=False, default=list)
    description_raw = Column(Text, nullable=True)
    description_clean = Column(Text, nullable=False)
    application_type = Column(String(30), nullable=False)
    ats_provider = Column(String(30), nullable=False)
    application_url = Column(Text, nullable=False)
    date_posted = Column(DateTime, nullable=True)
    date_discovered = Column(DateTime, nullable=False, server_default=func.now())
    status = Column(String(30), nullable=False, default="discovered")
    match_score = Column(Float, nullable=True)
    match_reasons = Column(JSON, nullable=False, default=list)
    job_metadata = Column("metadata", JSON, nullable=False, default=dict)

    # Relationships
    tailored_resumes = relationship(
        "TailoredResume", back_populates="job", cascade="all, delete-orphan"
    )
    applications = relationship(
        "Application", back_populates="job", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_jobs_fingerprint", "fingerprint"),
        Index("idx_jobs_status", "status"),
        Index("idx_jobs_match_score", "match_score"),
        Index("idx_jobs_company", "company"),
    )


class TailoredResume(Base):
    __tablename__ = "tailored_resumes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(
        String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    candidate_id = Column(
        String(36),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    selected_bullet_ids = Column(JSON, nullable=False, default=list)
    tailored_summary = Column(Text, nullable=False)
    skills_ordering = Column(JSON, nullable=False, default=list)
    typst_source = Column(Text, nullable=False)
    resume_pdf_path = Column(Text, nullable=False)
    cover_letter_text = Column(Text, nullable=False)
    cover_letter_pdf_path = Column(Text, nullable=True)
    cover_letter_tone = Column(String(30), nullable=False, default="technical_direct")
    fact_check_status = Column(String(20), nullable=False)  # PASSED | FAILED | WARNING
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    job = relationship("Job", back_populates="tailored_resumes")
    candidate = relationship("CandidateProfile", back_populates="tailored_resumes")
    applications = relationship("Application", back_populates="tailored_resume")

    __table_args__ = (Index("idx_tailored_job", "job_id"),)
