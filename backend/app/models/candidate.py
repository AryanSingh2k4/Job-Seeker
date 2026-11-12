import uuid

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    full_name = Column(String(120), nullable=False)
    email = Column(String(160), nullable=False, unique=True)
    phone = Column(String(32), nullable=False)
    city = Column(String(80), nullable=False)
    state = Column(String(80), nullable=False)
    country = Column(String(60), nullable=False)
    postal_code = Column(String(20), nullable=True)
    linkedin_url = Column(Text, nullable=True)
    github_url = Column(Text, nullable=True)
    portfolio_url = Column(Text, nullable=True)
    citizenship = Column(JSON, nullable=False, default=list)  # JSON array
    work_authorization = Column(String(80), nullable=False)
    requires_sponsorship = Column(Boolean, nullable=False, default=False)
    requires_future_sponsorship = Column(Boolean, nullable=False, default=False)
    target_salary_min = Column(Integer, nullable=True)
    target_salary_desired = Column(Integer, nullable=True)
    notice_period_weeks = Column(Integer, nullable=False, default=2)
    willing_to_relocate = Column(Boolean, nullable=False, default=False)
    summary_baseline = Column(Text, nullable=False)
    target_preferences = Column(JSON, nullable=False, default=dict)  # JSON object
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    skills = relationship(
        "Skill", back_populates="candidate", cascade="all, delete-orphan"
    )
    work_experiences = relationship(
        "WorkExperience", back_populates="candidate", cascade="all, delete-orphan"
    )
    education = relationship(
        "Education", back_populates="candidate", cascade="all, delete-orphan"
    )
    projects = relationship(
        "Project", back_populates="candidate", cascade="all, delete-orphan"
    )
    certifications = relationship(
        "Certification", back_populates="candidate", cascade="all, delete-orphan"
    )
    qa_knowledge_base = relationship(
        "QAKnowledgeBase", back_populates="candidate", cascade="all, delete-orphan"
    )
    resume_import_drafts = relationship(
        "ResumeImportDraft", back_populates="candidate", cascade="all, delete-orphan"
    )
    tailored_resumes = relationship(
        "TailoredResume", back_populates="candidate", cascade="all, delete-orphan"
    )


class Skill(Base):
    __tablename__ = "skills"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    candidate_id = Column(
        String(36),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    canonical_name = Column(String(80), nullable=False)
    category = Column(String(40), nullable=False)
    proficiency = Column(String(20), nullable=False)
    years_of_experience = Column(Float, nullable=False)
    last_used_year = Column(Integer, nullable=False)
    aliases = Column(JSON, nullable=False, default=list)

    candidate = relationship("CandidateProfile", back_populates="skills")

    __table_args__ = (Index("idx_skills_candidate", "candidate_id"),)


class WorkExperience(Base):
    __tablename__ = "work_experiences"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    candidate_id = Column(
        String(36),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_name = Column(String(120), nullable=False)
    company_url = Column(Text, nullable=True)
    role_title = Column(String(120), nullable=False)
    location = Column(String(80), nullable=False)
    location_type = Column(String(20), nullable=False)
    start_date = Column(String(10), nullable=False)
    end_date = Column(String(10), nullable=True)
    is_current = Column(Boolean, nullable=False, default=False)
    technologies = Column(JSON, nullable=False, default=list)

    candidate = relationship("CandidateProfile", back_populates="work_experiences")
    bullets = relationship(
        "ExperienceBullet",
        back_populates="work_experience",
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("idx_work_exp_candidate", "candidate_id"),)


class Education(Base):
    __tablename__ = "education"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    candidate_id = Column(
        String(36),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    institution = Column(String(160), nullable=False)
    degree = Column(String(120), nullable=False)
    field_of_study = Column(String(120), nullable=False)
    start_date = Column(String(10), nullable=False)
    end_date = Column(String(10), nullable=True)
    gpa = Column(String(16), nullable=True)
    honors = Column(JSON, nullable=False, default=list)
    relevant_coursework = Column(JSON, nullable=False, default=list)

    candidate = relationship("CandidateProfile", back_populates="education")

    __table_args__ = (Index("idx_education_candidate", "candidate_id"),)


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    candidate_id = Column(
        String(36),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = Column(String(160), nullable=False)
    role = Column(String(120), nullable=False)
    repo_url = Column(Text, nullable=True)
    live_url = Column(Text, nullable=True)
    start_date = Column(String(10), nullable=True)
    end_date = Column(String(10), nullable=True)
    technologies = Column(JSON, nullable=False, default=list)

    candidate = relationship("CandidateProfile", back_populates="projects")
    bullets = relationship(
        "ExperienceBullet", back_populates="project", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("idx_projects_candidate", "candidate_id"),)


class Certification(Base):
    __tablename__ = "certifications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    candidate_id = Column(
        String(36),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = Column(String(160), nullable=False)
    issuing_organization = Column(String(160), nullable=False)
    issue_date = Column(String(10), nullable=False)
    expiration_date = Column(String(10), nullable=True)
    credential_id = Column(String(120), nullable=True)
    verification_url = Column(Text, nullable=True)

    candidate = relationship("CandidateProfile", back_populates="certifications")

    __table_args__ = (Index("idx_certifications_candidate", "candidate_id"),)


class ExperienceBullet(Base):
    __tablename__ = "experience_bullets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    experience_id = Column(
        String(36), ForeignKey("work_experiences.id", ondelete="CASCADE"), nullable=True
    )
    project_id = Column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True
    )
    raw_text = Column(Text, nullable=False)
    action_verb = Column(String(40), nullable=False)
    skills_used = Column(JSON, nullable=False, default=list)
    metrics_quantified = Column(JSON, nullable=False, default=list)
    domain_tags = Column(JSON, nullable=False, default=list)
    verified = Column(Boolean, nullable=False, default=False)
    priority_score = Column(Float, nullable=False, default=1.0)

    work_experience = relationship("WorkExperience", back_populates="bullets")
    project = relationship("Project", back_populates="bullets")

    __table_args__ = (
        Index("idx_bullets_exp", "experience_id"),
        Index("idx_bullets_project", "project_id"),
    )


class QAKnowledgeBase(Base):
    __tablename__ = "qa_knowledge_base"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    candidate_id = Column(
        String(36),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    category = Column(String(40), nullable=False)
    question_canonical = Column(String(120), nullable=False)
    question_patterns = Column(JSON, nullable=False, default=list)
    answer_value = Column(Text, nullable=False)
    answer_type = Column(String(20), nullable=False)
    source = Column(String(20), nullable=False, default="USER_VERIFIED")
    confidence_score = Column(Float, nullable=False, default=1.0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    candidate = relationship("CandidateProfile", back_populates="qa_knowledge_base")

    __table_args__ = (Index("idx_qa_candidate", "candidate_id"),)


class ResumeImportDraft(Base):
    __tablename__ = "resume_import_drafts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    candidate_id = Column(
        String(36),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=True,
    )
    file_name = Column(String(255), nullable=False)
    parsed_json = Column(JSON, nullable=False)
    status = Column(
        String(20), nullable=False, default="DRAFT"
    )  # DRAFT | CONFIRMED | DISCARDED
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    expires_at = Column(DateTime, nullable=True)

    candidate = relationship("CandidateProfile", back_populates="resume_import_drafts")

    __table_args__ = (Index("idx_import_drafts_status", "status"),)
