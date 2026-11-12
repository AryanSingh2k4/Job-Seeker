"""Stdout handshake emitter for JobSeeker sidecar (§4.1)."""

from __future__ import annotations

import json
import os
import sys


def emit_handshake(port: int, token: str, version: str = "2.0.0") -> None:
    payload = {
        "port": port,
        "token": token,
        "pid": os.getpid(),
        "version": version,
    }
    line = f"AUTOJOB_READY {json.dumps(payload)}\n"
    sys.stdout.write(line)
    sys.stdout.flush()
