"""Unit tests for Tailoring, Fact-Check Guardrail, Typst Compilation, and Cover Letters (Milestone 3)."""

import pytest
from app.matcher.cover_letter import generate_cover_letter
from app.matcher.factcheck import (
    MetricTamperingException,
    extract_metrics,
    fact_check_resume,
    validate_tailored_bullet,
)
from app.matcher.render import compile_typst, to_typst_code, verify_ats_round_trip
from app.matcher.tailor import TailoredResumeData


def test_metric_extraction():
    text = "Improved throughput by 45% and reduced latency by 120ms, saving $1.2M annually across 10k nodes."
    metrics = extract_metrics(text)
    assert "45%" in metrics
    assert "120" in metrics or "120ms" in metrics or any("120" in m for m in metrics)
    assert "$1.2m" in metrics or any("1.2" in m for m in metrics)


def test_fact_check_verbatim_pass():
    master = "Engineered distributed streaming pipeline handling 50k events/sec."
    tailored = "Engineered distributed streaming pipeline handling 50k events/sec."
    passed, msg = validate_tailored_bullet(tailored, master)
    assert passed is True


def test_fact_check_metric_tampering_fails():
    master = "Engineered distributed streaming pipeline handling 50k events/sec."
    tampered = "Engineered distributed streaming pipeline handling 100k events/sec."
    # Different text fails verbatim check
    passed, msg = validate_tailored_bullet(tampered, master)
    assert passed is False


def test_fact_check_resume_pool():
    pool = {
        "b1": "Architected microservices handling 2M requests/day.",
        "b2": "Reduced AWS infrastructure costs by 30%.",
    }
    # Both valid
    passed, reasons = fact_check_resume([
        "Architected microservices handling 2M requests/day.",
        "Reduced AWS infrastructure costs by 30%.",
    ], pool)
    assert passed is True

    # Includes invented bullet
    passed_invented, reasons_inv = fact_check_resume([
        "Led team of 20 engineers to build an AI search engine.",
    ], pool)
    assert passed_invented is False
    assert any("unearned_bullet" in r for r in reasons_inv)


def test_cover_letter_generation():
    letter = generate_cover_letter(
        candidate_name="Ada Lovelace",
        job_title="Senior Systems Engineer",
        company_name="Acme Corp",
        top_bullet="Built analytical engine processing 10k operations/min.",
        tone="technical_direct",
    )
    assert "Acme Corp" in letter
    assert "Senior Systems Engineer" in letter
    assert "Built analytical engine processing 10k operations/min." in letter
    assert "Ada Lovelace" in letter
    paragraphs = [p for p in letter.split("\n\n") if p.strip()]
    assert len(paragraphs) >= 3


def test_typst_template_and_round_trip(tmp_path):
    data = TailoredResumeData(
        candidate_id="cand-1",
        job_id="job-1",
        full_name="Ada Lovelace",
        email="ada@example.com",
        phone="+1 555-0100",
        location="London, UK",
        linkedin_url="https://linkedin.com/in/ada",
        github_url="https://github.com/ada",
        summary_sentence="Pioneering computer scientist and mathematician.",
        skills_by_category={"Languages": ["Python", "FastAPI", "C++"]},
        experiences=[
            {
                "company_name": "Babbage Labs",
                "role_title": "Lead Mathematician",
                "location": "London",
                "start_date": "1842-01",
                "end_date": "1843-12",
                "bullets": [
                    "Created first computer algorithm for the Analytical Engine.",
                    "Demonstrated Bernoulli number calculations with 100% accuracy.",
                ],
            }
        ],
        education=[
            {
                "institution": "University of London",
                "degree": "Master of Science",
                "field_of_study": "Mathematics",
                "start_year": "1835",
                "end_year": "1838",
            }
        ],
        projects=[],
    )

    typ_code = to_typst_code(data)
    assert "Ada Lovelace" in typ_code
    assert "Babbage Labs" in typ_code

    pdf_path = tmp_path / "resume_test.pdf"
    compile_typst(typ_code, pdf_path)
    assert pdf_path.is_file()
    assert pdf_path.stat().st_size > 0

    # ATS round-trip
    verified = verify_ats_round_trip(pdf_path, [
        "Created first computer algorithm for the Analytical Engine.",
        "Demonstrated Bernoulli number calculations with 100% accuracy.",
    ])
    assert verified is True
