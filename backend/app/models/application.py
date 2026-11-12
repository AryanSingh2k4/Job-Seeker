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


class Application(Base):
    __tablename__ = "applications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(
        String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    tailored_resume_id = Column(
        String(36),
        ForeignKey("tailored_resumes.id", ondelete="SET NULL"),
        nullable=True,
    )
    platform = Column(String(40), nullable=False)
    submission_mode = Column(String(30), nullable=False, default="ASSISTED_REVIEW")
    status = Column(String(30), nullable=False, default="QUEUED")
    started_at = Column(DateTime, nullable=False, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0)
    confirmation_receipt = Column(Text, nullable=True)
    screenshot_path = Column(Text, nullable=True)
    failure_stage = Column(String(40), nullable=True)
    failure_reason = Column(Text, nullable=True)

    # Relationships
    job = relationship("Job", back_populates="applications")
    tailored_resume = relationship("TailoredResume", back_populates="applications")
    qa_answers = relationship(
        "QAAnswerAudit", back_populates="application", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_applications_status", "status"),
        Index("idx_applications_job", "job_id"),
    )


class QAAnswerAudit(Base):
    __tablename__ = "qa_answers_audit"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(
        String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
    )
    question_text = Column(Text, nullable=False)
    answer_value = Column(Text, nullable=False)
    resolution_tier = Column(
        String(30), nullable=False
    )  # DETERMINISTIC | LLM_GENERATED | USER_OVERRIDE
    confidence_score = Column(Float, nullable=False)
    user_verified = Column(Boolean, nullable=False, default=False)
    timestamp = Column(DateTime, nullable=False, server_default=func.now())

    application = relationship("Application", back_populates="qa_answers")

    __table_args__ = (Index("idx_qa_audit_app", "application_id"),)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    entity_type = Column(String(40), nullable=False)
    entity_id = Column(String(36), nullable=True)
    event_type = Column(String(60), nullable=False)
    severity = Column(String(20), nullable=False, default="INFO")
    message = Column(Text, nullable=False)
    details = Column(JSON, nullable=False, default=dict)
    timestamp = Column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (Index("idx_audit_logs_timestamp", "timestamp"),)
