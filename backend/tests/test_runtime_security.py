"""Tests for runtime security, token auth, host validation, and error envelopes."""

import pytest
from fastapi.testclient import TestClient
from app.main import create_app


def test_token_middleware_enforcement():
    test_token = "secret-token-xyz-123"
    secured_app = create_app(token=test_token, port=8000, enforce_token=True)
    client = TestClient(secured_app)

    # Missing token -> 401
    resp_no_auth = client.get("/health")
    assert resp_no_auth.status_code == 401
    assert resp_no_auth.json()["error"]["code"] == "unauthorized"

    # Wrong token -> 403
    resp_bad_auth = client.get("/health", headers={"Authorization": "Bearer wrong-token"})
    assert resp_bad_auth.status_code == 403
    assert resp_bad_auth.json()["error"]["code"] == "forbidden"

    # Correct token -> 200
    resp_good_auth = client.get("/health", headers={"Authorization": f"Bearer {test_token}"})
    assert resp_good_auth.status_code == 200
    assert resp_good_auth.json()["status"] == "ok"


def test_host_header_validation():
    test_app = create_app(enforce_token=False)
    client = TestClient(test_app)

    # Valid Host header
    resp_ok = client.get("/health", headers={"Host": "127.0.0.1:8000"})
    assert resp_ok.status_code == 200

    # Malicious Host header -> 403
    resp_evil = client.get("/health", headers={"Host": "evil-rebinding.com"})
    assert resp_evil.status_code == 403
    assert resp_evil.json()["error"]["code"] == "forbidden"


def test_error_envelope_404():
    test_app = create_app(enforce_token=False)
    client = TestClient(test_app)

    resp = client.get("/api/v1/jobs/non-existent-uuid-1234")
    assert resp.status_code == 404
    data = resp.json()
    assert "error" in data
    assert data["error"]["code"] == "job_not_found"
    assert "message" in data["error"]
    assert "details" in data["error"]


def test_error_envelope_validation_422():
    test_app = create_app(enforce_token=False)
    client = TestClient(test_app)

    resp = client.post("/api/v1/settings/platform-optin", json={"platform": "linkedin"})
    assert resp.status_code == 422
    data = resp.json()
    assert "error" in data
    assert data["error"]["code"] == "validation_error"


def test_shutdown_endpoint():
    test_app = create_app(enforce_token=False)
    client = TestClient(test_app)

    resp = client.post("/internal/shutdown")
    assert resp.status_code == 202
    assert resp.json()["status"] == "shutting_down"
