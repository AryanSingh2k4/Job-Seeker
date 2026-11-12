from sqlalchemy import inspect, text

from app.db import engine
from app.models import (
    AppSetting,
    CandidateProfile,
    Certification,
    Education,
    ExperienceBullet,
    Project,
    QAKnowledgeBase,
    ResumeImportDraft,
    Skill,
    WorkExperience,
)

EXPECTED_TABLES = {
    "alembic_version",
    "app_settings",
    "audit_logs",
    "candidate_profiles",
    "certifications",
    "education",
    "experience_bullets",
    "jobs",
    "projects",
    "qa_answers_audit",
    "qa_knowledge_base",
    "resume_import_drafts",
    "skills",
    "tailored_resumes",
    "work_experiences",
    "applications",
}


def test_sqlite_pragmas():
    """Verify WAL mode, foreign keys, and busy timeout pragmas are applied."""
    with engine.connect() as conn:
        journal_mode = conn.execute(text("PRAGMA journal_mode;")).scalar()
        foreign_keys = conn.execute(text("PRAGMA foreign_keys;")).scalar()
        busy_timeout = conn.execute(text("PRAGMA busy_timeout;")).scalar()

        assert journal_mode.lower() == "wal"
        assert foreign_keys == 1
        assert busy_timeout == 5000


def test_all_15_tables_exist():
    """Verify all 15 schema v2.1 tables exist in the database."""
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table in EXPECTED_TABLES:
        assert table in existing_tables, f"Missing table: {table}"


def test_candidate_profile_crud_and_cascade(db_session):
    """Test candidate profile and cascade delete of related records."""
    candidate = CandidateProfile(
        full_name="Jane Doe",
        email="jane.doe@example.com",
        phone="+1234567890",
        city="San Francisco",
        state="CA",
        country="USA",
        postal_code="94105",
        citizenship=["US"],
        work_authorization="US Citizen",
        requires_sponsorship=False,
        summary_baseline="Experienced software engineer.",
        target_preferences={"remote": True},
    )
    db_session.add(candidate)
    db_session.flush()

    # Add skill
    skill = Skill(
        candidate_id=candidate.id,
        canonical_name="Python",
        category="backend",
        proficiency="expert",
        years_of_experience=6.5,
        last_used_year=2026,
        aliases=["python3", "py"],
    )
    db_session.add(skill)

    # Add work experience
    work = WorkExperience(
        candidate_id=candidate.id,
        company_name="Tech Corp",
        role_title="Senior Backend Engineer",
        location="San Francisco, CA",
        location_type="remote",
        start_date="2022-01",
        end_date="2026-01",
        is_current=False,
        technologies=["Python", "FastAPI"],
    )
    db_session.add(work)
    db_session.flush()

    # Add bullet
    bullet = ExperienceBullet(
        experience_id=work.id,
        raw_text="Reduced API latency by 45% using async pipelines.",
        action_verb="Reduced",
        skills_used=["Python", "FastAPI"],
        metrics_quantified=["45%"],
        domain_tags=["backend", "performance"],
        verified=True,
        priority_score=1.5,
    )
    db_session.add(bullet)

    # Add education
    edu = Education(
        candidate_id=candidate.id,
        institution="UC Berkeley",
        degree="B.S.",
        field_of_study="Computer Science",
        start_date="2016-08",
        end_date="2020-05",
        gpa="3.8",
    )
    db_session.add(edu)

    # Add project
    project = Project(
        candidate_id=candidate.id,
        name="AutoJob",
        role="Lead Architect",
        start_date="2026-01",
        technologies=["Python", "SQLite"],
    )
    db_session.add(project)

    # Add certification
    cert = Certification(
        candidate_id=candidate.id,
        name="AWS Certified Solutions Architect",
        issuing_organization="Amazon Web Services",
        issue_date="2023-05",
    )
    db_session.add(cert)

    # Add QA
    qa = QAKnowledgeBase(
        candidate_id=candidate.id,
        category="work_auth",
        question_canonical="Are you authorized to work in the US?",
        question_patterns=["authorized to work", "legally authorized"],
        answer_value="Yes",
        answer_type="boolean",
    )
    db_session.add(qa)

    # Add Resume Import Draft
    draft = ResumeImportDraft(
        candidate_id=candidate.id,
        file_name="resume.pdf",
        parsed_json={"skills": ["Python"]},
        status="DRAFT",
    )
    db_session.add(draft)

    # Add AppSetting
    setting = AppSetting(
        key="mode",
        value="assisted",
    )
    db_session.merge(setting)

    db_session.commit()

    # Verify query
    fetched_candidate = (
        db_session.query(CandidateProfile).filter_by(id=candidate.id).first()
    )
    assert fetched_candidate is not None
    assert len(fetched_candidate.skills) == 1
    assert len(fetched_candidate.work_experiences) == 1
    assert len(fetched_candidate.education) == 1
    assert len(fetched_candidate.projects) == 1
    assert len(fetched_candidate.certifications) == 1
    assert len(fetched_candidate.qa_knowledge_base) == 1
    assert len(fetched_candidate.resume_import_drafts) == 1

    # Test cascade delete
    db_session.delete(fetched_candidate)
    db_session.commit()

    assert db_session.query(Skill).filter_by(candidate_id=candidate.id).count() == 0
    assert (
        db_session.query(WorkExperience).filter_by(candidate_id=candidate.id).count()
        == 0
    )
    assert db_session.query(Education).filter_by(candidate_id=candidate.id).count() == 0
    assert db_session.query(Project).filter_by(candidate_id=candidate.id).count() == 0
    assert (
        db_session.query(Certification).filter_by(candidate_id=candidate.id).count()
        == 0
    )
    assert (
        db_session.query(QAKnowledgeBase).filter_by(candidate_id=candidate.id).count()
        == 0
    )
