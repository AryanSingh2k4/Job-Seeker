"""Tests for /health endpoint (§7.0)."""

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_endpoint_shape(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()

    assert data["status"] in {"ok", "degraded"}
    assert data["db"] is True
    assert isinstance(data["browser"], dict)
    assert data["browser"]["running"] is False

    assert isinstance(data["llm"], dict)
    assert "configured" in data["llm"]
    assert "degraded" in data["llm"]

    assert isinstance(data["scheduler"], dict)
    assert data["scheduler"]["crawl"] == "idle"
    assert data["scheduler"]["match"] == "idle"
    assert data["scheduler"]["apply"] == "idle"

    assert isinstance(data["caps_today"], dict)
    assert "linkedin" in data["caps_today"]
    assert data["caps_today"]["linkedin"]["limit"] == 25
    assert "ats" in data["caps_today"]
    assert data["caps_today"]["ats"]["limit"] == 40

    assert data["version"] == "2.0.0"
    assert data["contract_version"] == "1"

    assert isinstance(data["runtime"], dict)
    assert data["runtime"]["mode"] in {"dev", "sidecar"}
