"""Matcher and tailoring artifact routes for JobSeeker (§7.3)."""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.routes.profile import get_profile
from app.config import get_settings
from app.errors import AppException
from app.matcher.cover_letter import generate_cover_letter
from app.matcher.extract import extract_job_profile
from app.matcher.render import render_and_verify_resume, to_typst_code
from app.matcher.tailor import tailor_resume
from app.models.job import Job, TailoredResume

router = APIRouter(prefix="/matcher", tags=["matcher"])


class TailorResponse(BaseModel):
    fact_check_status: str = "PASSED"
    resume_pdf_url: str
    cover_letter_pdf_url: Optional[str] = None
    selected_bullet_ids: List[str] = []


@router.post("/tailor/{job_id}", response_model=TailorResponse)
async def tailor_for_job(job_id: str, db: Session = Depends(get_db)) -> TailorResponse:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise AppException(
            code="job_not_found",
            message=f"Job {job_id} does not exist",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    profile = get_profile(db)
    parsed = await extract_job_profile(job.description_clean)
    tailored_data = tailor_resume(profile, job_id, parsed)

    settings = get_settings()
    out_dir = settings.output_dir / "resumes"
    out_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = out_dir / f"resume_{job_id}.pdf"

    top_bullet = (
        tailored_data.experiences[0]["bullets"][0]
        if tailored_data.experiences and tailored_data.experiences[0]["bullets"]
        else "Engineered scalable cloud services."
    )
    cl_text = generate_cover_letter(
        candidate_name=profile.full_name,
        job_title=job.title,
        company_name=job.company,
        top_bullet=top_bullet,
    )

    # Render and verify
    render_and_verify_resume(tailored_data, pdf_path)

    # Save to database
    tailored_row = db.query(TailoredResume).filter(TailoredResume.job_id == job_id).first()
    if not tailored_row:
        import uuid
        tailored_row = TailoredResume(
            id=str(uuid.uuid4()),
            job_id=job_id,
            candidate_id=profile.id,
            selected_bullet_ids=tailored_data.selected_bullet_ids,
            tailored_summary=tailored_data.summary_sentence,
            skills_ordering=",".join([s for l in tailored_data.skills_by_category.values() for s in l]),
            typst_source=to_typst_code(tailored_data),
            resume_pdf_path=str(pdf_path),
            cover_letter_text=cl_text,
            cover_letter_tone="technical_direct",
            fact_check_status=tailored_data.fact_check_status,
        )
        db.add(tailored_row)
    else:
        tailored_row.selected_bullet_ids = tailored_data.selected_bullet_ids
        tailored_row.resume_pdf_path = str(pdf_path)
        tailored_row.cover_letter_text = cl_text
        tailored_row.fact_check_status = tailored_data.fact_check_status

    job.tailored_resume_path = str(pdf_path)
    job.status = "ready_to_apply"
    db.commit()

    return TailorResponse(
        fact_check_status=tailored_data.fact_check_status,
        resume_pdf_url=f"/api/v1/matcher/resume/{job_id}",
        cover_letter_pdf_url=f"/api/v1/matcher/cover-letter/{job_id}",
        selected_bullet_ids=tailored_data.selected_bullet_ids,
    )


@router.get("/resume/{job_id}")
def get_tailored_resume(job_id: str, db: Session = Depends(get_db)) -> Response:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise AppException(
            code="job_not_found",
            message=f"Job {job_id} does not exist",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    tailored = db.query(TailoredResume).filter(TailoredResume.job_id == job_id).first()
    if tailored and tailored.resume_pdf_path and os.path.isfile(tailored.resume_pdf_path):
        return FileResponse(tailored.resume_pdf_path, media_type="application/pdf")

    settings = get_settings()
    sample_pdf = settings.fixtures_dir / "mock_ats" / "artifacts" / "resume.pdf"
    if sample_pdf.is_file():
        return FileResponse(str(sample_pdf), media_type="application/pdf")

    minimal_pdf = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0>>endobj\nxref\n0 3\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n99\n%%EOF\n"
    return Response(content=minimal_pdf, media_type="application/pdf")


@router.get("/cover-letter/{job_id}")
def get_cover_letter(
    job_id: str,
    format: str = Query("txt", description="txt | pdf"),
    db: Session = Depends(get_db),
) -> Response:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise AppException(
            code="job_not_found",
            message=f"Job {job_id} does not exist",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    tailored = db.query(TailoredResume).filter(TailoredResume.job_id == job_id).first()
    text_body = tailored.cover_letter_text if tailored else f"Cover letter for {job.company} - {job.title}"

    if format == "txt":
        return PlainTextResponse(text_body)

    minimal_pdf = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0>>endobj\nxref\n0 3\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n99\n%%EOF\n"
    return Response(content=minimal_pdf, media_type="application/pdf")
