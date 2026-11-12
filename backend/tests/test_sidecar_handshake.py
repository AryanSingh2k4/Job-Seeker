"""Tests for sidecar handshake and CLI port-0 binding (§4.1)."""

import io
import json
import os
import sys
from unittest.mock import patch
from app.runtime.handshake import emit_handshake
from app.runtime.token import generate_token, validate_token


def test_handshake_emission_format():
    token = generate_token()
    assert len(token) > 20
    assert validate_token(token, token) is True
    assert validate_token(token, "wrong") is False

    captured = io.StringIO()
    with patch("sys.stdout", captured):
        emit_handshake(port=54321, token=token, version="2.0.0")

    output = captured.getvalue()
    assert output.startswith("AUTOJOB_READY ")
    raw_json = output.replace("AUTOJOB_READY ", "").strip()
    data = json.loads(raw_json)

    assert data["port"] == 54321
    assert data["token"] == token
    assert data["pid"] == os.getpid()
    assert data["version"] == "2.0.0"
