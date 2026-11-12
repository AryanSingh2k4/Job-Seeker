"""Tests for Milestone 6 (Stats Analytics, CSV Export, Workday Adapter)."""

import csv
import io
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.applier.adapters.workday import WorkdayAdapter
from app.db import SessionLocal
from app.main import create_app
from app.models.application import Application
from app.models.job import Job


def test_workday_adapter_can_handle():
    adapter = WorkdayAdapter()
    assert adapter.can_handle("https://acme.myworkdayjobs.com/en-US/careers/job/1234")
    assert not adapter.can_handle("https://jobs.ashbyhq.com/company/role-123")


def test_application_stats_and_csv_export():
    app = create_app()
    client = TestClient(app)
    db = SessionLocal()

    # Seed test job and application
    job_id = str(uuid.uuid4())
    job = Job(
        id=job_id,
        fingerprint=str(uuid.uuid4()),
        source="test",
        source_url="https://example.com/job",
        canonical_url="https://example.com/job",
        title="Distributed Systems Engineer",
        company="Apex Global",
        location="Remote",
        description_clean="Test job description",
        application_type="ATS",
        application_url="https://example.com/apply",
        ats_provider="GREENHOUSE",
        status="applied",
    )
    db.add(job)

    app_id = str(uuid.uuid4())
    application = Application(
        id=app_id,
        job_id=job_id,
        platform="GREENHOUSE",
        submission_mode="ASSISTED_REVIEW",
        status="SUBMITTED",
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        duration_seconds=42,
        confirmation_receipt="GH-CONFIRMED-999",
    )
    db.add(application)
    db.commit()

    try:
        # 1. Test GET /api/v1/applications/stats
        stats_resp = client.get("/api/v1/applications/stats")
        assert stats_resp.status_code == 200
        stats_json = stats_resp.json()
        assert stats_json["total_applications"] >= 1
        assert stats_json["submitted_count"] >= 1
        assert "GREENHOUSE" in stats_json["by_platform"]
        assert stats_json["average_duration_seconds"] > 0

        # 2. Test GET /api/v1/applications/export
        export_resp = client.get("/api/v1/applications/export")
        assert export_resp.status_code == 200
        assert export_resp.headers["content-type"].startswith("text/csv")
        assert "attachment" in export_resp.headers["content-disposition"]

        reader = csv.reader(io.StringIO(export_resp.text))
        rows = list(reader)
        assert len(rows) >= 2  # header + at least 1 record
        header = rows[0]
        assert "id" in header
        assert "company" in header
        assert "status" in header
        assert "confirmation_receipt" in header

        # Verify our record exists in CSV
        found = False
        for row in rows[1:]:
            if row[0] == app_id:
                found = True
                assert "Apex Global" in row
                assert "SUBMITTED" in row
                assert "GH-CONFIRMED-999" in row
                break
        assert found, f"Application {app_id} not found in exported CSV"

    finally:
        # Cleanup
        db.query(Application).filter(Application.id == app_id).delete()
        db.query(Job).filter(Job.id == job_id).delete()
        db.commit()
        db.close()
