"""Candidate Profile routes for JobSeeker (§7.1)."""

from __future__ import annotations

import json
import uuid
from typing import List
from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.errors import AppException
from app.models.candidate import (
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
from app.schemas.profile import (
    BulletOut,
    CandidateProfileIn,
    CandidateProfileOut,
    CertificationOut,
    EducationOut,
    ProjectOut,
    QAKnowledgeItem,
    ResumeImportConfirmIn,
    ResumeImportDraftOut,
    SkillOut,
    WorkExperienceOut,
)

router = APIRouter(prefix="/profile", tags=["profile"])


def _load_full_profile(db: Session, profile: CandidateProfile) -> CandidateProfileOut:
    skills = db.query(Skill).filter(Skill.candidate_id == profile.id).all()
    experiences = db.query(WorkExperience).filter(WorkExperience.candidate_id == profile.id).all()
    education = db.query(Education).filter(Education.candidate_id == profile.id).all()
    projects = db.query(Project).filter(Project.candidate_id == profile.id).all()
    certifications = db.query(Certification).filter(Certification.candidate_id == profile.id).all()
    qa_list = db.query(QAKnowledgeBase).filter(QAKnowledgeBase.candidate_id == profile.id).all()

    # Load bullets for experiences and projects
    exp_outs = []
    for exp in experiences:
        bullets = db.query(ExperienceBullet).filter(ExperienceBullet.experience_id == exp.id).all()
        b_outs = [
            BulletOut(
                id=b.id,
                experience_id=b.experience_id,
                project_id=b.project_id,
                raw_text=b.raw_text,
                action_verb=b.action_verb,
                skills_used=b.skills_used or [],
                metrics_quantified=b.metrics_quantified or [],
                domain_tags=b.domain_tags or [],
                verified=b.verified,
                priority_score=b.priority_score,
            )
            for b in bullets
        ]
        exp_outs.append(
            WorkExperienceOut(
                id=exp.id,
                candidate_id=exp.candidate_id,
                company_name=exp.company_name,
                company_url=exp.company_url,
                role_title=exp.role_title,
                location=exp.location,
                location_type=exp.location_type,
                start_date=exp.start_date,
                end_date=exp.end_date,
                is_current=exp.is_current,
                technologies=exp.technologies or [],
                bullets=b_outs,
            )
        )

    proj_outs = []
    for proj in projects:
        bullets = db.query(ExperienceBullet).filter(ExperienceBullet.project_id == proj.id).all()
        b_outs = [
            BulletOut(
                id=b.id,
                experience_id=b.experience_id,
                project_id=b.project_id,
                raw_text=b.raw_text,
                action_verb=b.action_verb,
                skills_used=b.skills_used or [],
                metrics_quantified=b.metrics_quantified or [],
                domain_tags=b.domain_tags or [],
                verified=b.verified,
                priority_score=b.priority_score,
            )
            for b in bullets
        ]
        proj_outs.append(
            ProjectOut(
                id=proj.id,
                candidate_id=proj.candidate_id,
                name=proj.name,
                description=proj.description,
                url=proj.url,
                technologies=proj.technologies or [],
                start_date=proj.start_date,
                end_date=proj.end_date,
                bullets=b_outs,
            )
        )

    return CandidateProfileOut(
        id=profile.id,
        full_name=profile.full_name,
        email=profile.email,
        phone=profile.phone,
        city=profile.city,
        state=profile.state,
        country=profile.country,
        postal_code=profile.postal_code,
        linkedin_url=profile.linkedin_url,
        github_url=profile.github_url,
        portfolio_url=profile.portfolio_url,
        citizenship=profile.citizenship or ["US"],
        work_authorization=profile.work_authorization,
        requires_sponsorship=profile.requires_sponsorship,
        requires_future_sponsorship=profile.requires_future_sponsorship,
        target_salary_min=profile.target_salary_min,
        target_salary_desired=profile.target_salary_desired,
        notice_period_weeks=profile.notice_period_weeks,
        willing_to_relocate=profile.willing_to_relocate,
        summary_baseline=profile.summary_baseline,
        target_preferences=profile.target_preferences or {},
        created_at=profile.created_at,
        updated_at=profile.updated_at,
        skills=[
            SkillOut(
                id=s.id,
                candidate_id=s.candidate_id,
                canonical_name=s.canonical_name,
                category=s.category,
                proficiency=s.proficiency,
                years_of_experience=s.years_of_experience,
                last_used_year=s.last_used_year,
                aliases=s.aliases or [],
            )
            for s in skills
        ],
        work_experiences=exp_outs,
        education=[
            EducationOut(
                id=e.id,
                candidate_id=e.candidate_id,
                institution=e.institution,
                degree=e.degree,
                field_of_study=e.field_of_study,
                start_year=e.start_year,
                end_year=e.end_year,
                gpa=e.gpa,
                honors=e.honors or [],
            )
            for e in education
        ],
        projects=proj_outs,
        certifications=[
            CertificationOut(
                id=c.id,
                candidate_id=c.candidate_id,
                name=c.name,
                issuing_organization=c.issuing_organization,
                issue_date=c.issue_date,
                expiration_date=c.expiration_date,
                credential_id=c.credential_id,
                credential_url=c.credential_url,
            )
            for c in certifications
        ],
        qa=[
            QAKnowledgeItem(
                id=q.id,
                category=q.category,
                question_canonical=q.question_canonical,
                question_patterns=q.question_patterns or [],
                answer_value=q.answer_value,
                answer_type=q.answer_type,
                source=q.source,
                confidence_score=q.confidence_score,
            )
            for q in qa_list
        ],
    )


@router.get("", response_model=CandidateProfileOut)
def get_profile(db: Session = Depends(get_db)) -> CandidateProfileOut:
    profile = db.query(CandidateProfile).first()
    if not profile:
        raise AppException(
            code="not_found",
            message="No candidate profile configured yet",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return _load_full_profile(db, profile)


@router.post("", response_model=CandidateProfileOut)
def upsert_profile(payload: CandidateProfileIn, db: Session = Depends(get_db)) -> CandidateProfileOut:
    profile = db.query(CandidateProfile).first()
    if not profile:
        profile = CandidateProfile(id=str(uuid.uuid4()))
        db.add(profile)

    profile.full_name = payload.full_name
    profile.email = payload.email
    profile.phone = payload.phone
    profile.city = payload.city
    profile.state = payload.state
    profile.country = payload.country
    profile.postal_code = payload.postal_code
    profile.linkedin_url = payload.linkedin_url
    profile.github_url = payload.github_url
    profile.portfolio_url = payload.portfolio_url
    profile.citizenship = payload.citizenship
    profile.work_authorization = payload.work_authorization
    profile.requires_sponsorship = payload.requires_sponsorship
    profile.requires_future_sponsorship = payload.requires_future_sponsorship
    profile.target_salary_min = payload.target_salary_min
    profile.target_salary_desired = payload.target_salary_desired
    profile.notice_period_weeks = payload.notice_period_weeks
    profile.willing_to_relocate = payload.willing_to_relocate
    profile.summary_baseline = payload.summary_baseline
    profile.target_preferences = payload.target_preferences

    db.flush()

    # Sync skills
    if payload.skills:
        db.query(Skill).filter(Skill.candidate_id == profile.id).delete()
        for s in payload.skills:
            db.add(
                Skill(
                    id=str(uuid.uuid4()),
                    candidate_id=profile.id,
                    canonical_name=s.canonical_name,
                    category=s.category,
                    proficiency=s.proficiency,
                    years_of_experience=s.years_of_experience,
                    last_used_year=s.last_used_year,
                    aliases=s.aliases,
                )
            )

    # Sync work experiences + bullets
    if payload.work_experiences:
        db.query(WorkExperience).filter(WorkExperience.candidate_id == profile.id).delete()
        for exp in payload.work_experiences:
            exp_id = str(uuid.uuid4())
            db.add(
                WorkExperience(
                    id=exp_id,
                    candidate_id=profile.id,
                    company_name=exp.company_name,
                    company_url=exp.company_url,
                    role_title=exp.role_title,
                    location=exp.location,
                    location_type=exp.location_type,
                    start_date=exp.start_date,
                    end_date=exp.end_date,
                    is_current=exp.is_current,
                    technologies=exp.technologies,
                )
            )
            for b in exp.bullets:
                db.add(
                    ExperienceBullet(
                        id=str(uuid.uuid4()),
                        experience_id=exp_id,
                        raw_text=b.raw_text,
                        action_verb=b.action_verb,
                        skills_used=b.skills_used,
                        metrics_quantified=b.metrics_quantified,
                        domain_tags=b.domain_tags,
                        verified=b.verified,
                        priority_score=b.priority_score,
                    )
                )

    # Sync education
    if payload.education:
        db.query(Education).filter(Education.candidate_id == profile.id).delete()
        for edu in payload.education:
            db.add(
                Education(
                    id=str(uuid.uuid4()),
                    candidate_id=profile.id,
                    institution=edu.institution,
                    degree=edu.degree,
                    field_of_study=edu.field_of_study,
                    start_year=edu.start_year,
                    end_year=edu.end_year,
                    gpa=edu.gpa,
                    honors=edu.honors,
                )
            )

    # Sync projects
    if payload.projects:
        db.query(Project).filter(Project.candidate_id == profile.id).delete()
        for proj in payload.projects:
            proj_id = str(uuid.uuid4())
            db.add(
                Project(
                    id=proj_id,
                    candidate_id=profile.id,
                    name=proj.name,
                    description=proj.description,
                    url=proj.url,
                    technologies=proj.technologies,
                    start_date=proj.start_date,
                    end_date=proj.end_date,
                )
            )
            for b in proj.bullets:
                db.add(
                    ExperienceBullet(
                        id=str(uuid.uuid4()),
                        project_id=proj_id,
                        raw_text=b.raw_text,
                        action_verb=b.action_verb,
                        skills_used=b.skills_used,
                        metrics_quantified=b.metrics_quantified,
                        domain_tags=b.domain_tags,
                        verified=b.verified,
                        priority_score=b.priority_score,
                    )
                )

    # Sync certifications
    if payload.certifications:
        db.query(Certification).filter(Certification.candidate_id == profile.id).delete()
        for cert in payload.certifications:
            db.add(
                Certification(
                    id=str(uuid.uuid4()),
                    candidate_id=profile.id,
                    name=cert.name,
                    issuing_organization=cert.issuing_organization,
                    issue_date=cert.issue_date,
                    expiration_date=cert.expiration_date,
                    credential_id=cert.credential_id,
                    credential_url=cert.credential_url,
                )
            )

    db.commit()
    db.refresh(profile)
    return _load_full_profile(db, profile)


@router.post("/import-resume", response_model=ResumeImportDraftOut)
async def import_resume(file: UploadFile = File(...), db: Session = Depends(get_db)) -> ResumeImportDraftOut:
    content = await file.read()
    draft_id = str(uuid.uuid4())

    # In M1/M2 this parses via pypdf and/or LLM. For default fallback draft:
    draft_data = {
        "full_name": "Parsed Candidate",
        "email": "candidate@example.com",
        "phone": "+1 555-0100",
        "skills": [
            {"canonical_name": "Python", "proficiency": "expert", "years_of_experience": 5.0, "verified": False},
            {"canonical_name": "FastAPI", "proficiency": "advanced", "years_of_experience": 3.0, "verified": False},
        ],
        "work_experiences": [
            {
                "company_name": "Example Corp",
                "role_title": "Software Engineer",
                "location": "Remote",
                "start_date": "2022-01",
                "bullets": [
                    {
                        "raw_text": "Built scalable APIs reducing latency by 40%.",
                        "metrics_quantified": ["40%"],
                        "skills_used": ["Python", "FastAPI"],
                        "verified": False,
                    }
                ],
            }
        ],
    }

    db_draft = ResumeImportDraft(
        id=draft_id,
        parsed_json=draft_data,
        status="DRAFT",
    )
    db.add(db_draft)
    db.commit()

    return ResumeImportDraftOut(draft_id=draft_id, draft=draft_data)


@router.post("/import-resume/confirm", response_model=CandidateProfileOut)
def confirm_import_resume(payload: ResumeImportConfirmIn, db: Session = Depends(get_db)) -> CandidateProfileOut:
    draft = db.query(ResumeImportDraft).filter(ResumeImportDraft.id == payload.draft_id).first()
    if not draft:
        raise AppException(
            code="not_found",
            message="Resume import draft not found",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    profile = db.query(CandidateProfile).first()
    if not profile:
        profile = CandidateProfile(
            id=str(uuid.uuid4()),
            full_name=draft.parsed_json.get("full_name", "Candidate"),
            email=draft.parsed_json.get("email", "candidate@example.com"),
            phone=draft.parsed_json.get("phone", "+1 555-0100"),
            city="New York",
            state="NY",
            country="US",
            work_authorization="US Citizen",
            summary_baseline="Experienced software engineer.",
        )
        db.add(profile)
        db.flush()

    # Merge verified skills
    for s_data in draft.parsed_json.get("skills", []):
        db.add(
            Skill(
                id=str(uuid.uuid4()),
                candidate_id=profile.id,
                canonical_name=s_data["canonical_name"],
                category=s_data.get("category", "technical"),
                proficiency=s_data.get("proficiency", "advanced"),
                years_of_experience=s_data.get("years_of_experience", 1.0),
                last_used_year=s_data.get("last_used_year", 2026),
                aliases=s_data.get("aliases", []),
            )
        )

    # Merge verified experiences and bullets
    for exp_data in draft.parsed_json.get("work_experiences", []):
        exp_id = str(uuid.uuid4())
        db.add(
            WorkExperience(
                id=exp_id,
                candidate_id=profile.id,
                company_name=exp_data["company_name"],
                role_title=exp_data["role_title"],
                location=exp_data.get("location", "Remote"),
                location_type="remote",
                start_date=exp_data.get("start_date", "2022-01"),
            )
        )
        for b_data in exp_data.get("bullets", []):
            db.add(
                ExperienceBullet(
                    id=str(uuid.uuid4()),
                    experience_id=exp_id,
                    raw_text=b_data["raw_text"],
                    skills_used=b_data.get("skills_used", []),
                    metrics_quantified=b_data.get("metrics_quantified", []),
                    verified=True,  # Confirmed by user
                )
            )

    draft.status = "CONFIRMED"
    db.commit()
    db.refresh(profile)
    return _load_full_profile(db, profile)


@router.get("/qa", response_model=List[QAKnowledgeItem])
def list_qa(db: Session = Depends(get_db)) -> List[QAKnowledgeItem]:
    profile = db.query(CandidateProfile).first()
    if not profile:
        return []
    items = db.query(QAKnowledgeBase).filter(QAKnowledgeBase.candidate_id == profile.id).all()
    return [
        QAKnowledgeItem(
            id=q.id,
            category=q.category,
            question_canonical=q.question_canonical,
            question_patterns=q.question_patterns or [],
            answer_value=q.answer_value,
            answer_type=q.answer_type,
            source=q.source,
            confidence_score=q.confidence_score,
        )
        for q in items
    ]


@router.post("/qa", response_model=QAKnowledgeItem)
def upsert_qa(payload: QAKnowledgeItem, db: Session = Depends(get_db)) -> QAKnowledgeItem:
    profile = db.query(CandidateProfile).first()
    if not profile:
        profile = CandidateProfile(
            id=str(uuid.uuid4()),
            full_name="Candidate",
            email="candidate@example.com",
            phone="+1 555-0100",
            city="New York",
            state="NY",
            country="US",
            work_authorization="US Citizen",
            summary_baseline="",
        )
        db.add(profile)
        db.flush()

    row = (
        db.query(QAKnowledgeBase)
        .filter(
            QAKnowledgeBase.candidate_id == profile.id,
            QAKnowledgeBase.question_canonical == payload.question_canonical,
        )
        .first()
    )

    if not row:
        row = QAKnowledgeBase(
            id=str(uuid.uuid4()),
            candidate_id=profile.id,
            category=payload.category,
            question_canonical=payload.question_canonical,
            question_patterns=payload.question_patterns,
            answer_value=payload.answer_value,
            answer_type=payload.answer_type,
            source="USER_VERIFIED",
            confidence_score=payload.confidence_score,
        )
        db.add(row)
    else:
        row.category = payload.category
        row.question_patterns = payload.question_patterns
        row.answer_value = payload.answer_value
        row.answer_type = payload.answer_type
        row.source = "USER_VERIFIED"
        row.confidence_score = payload.confidence_score

    db.commit()
    db.refresh(row)
    return QAKnowledgeItem(
        id=row.id,
        category=row.category,
        question_canonical=row.question_canonical,
        question_patterns=row.question_patterns or [],
        answer_value=row.answer_value,
        answer_type=row.answer_type,
        source=row.source,
        confidence_score=row.confidence_score,
    )
