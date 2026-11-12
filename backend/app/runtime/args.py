"""Sidecar CLI argument parsing for JobSeeker.

Follows docs/DESKTOP_PACKAGING_SPEC.md §4.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class RuntimeArgs:
    data_dir: Path
    host: str = "127.0.0.1"
    port: int = 0
    parent_pid: Optional[int] = None
    shutdown_grace: int = 5
    log_level: str = "info"


def parse_args(argv: Optional[list[str]] = None) -> RuntimeArgs:
    parser = argparse.ArgumentParser(description="JobSeeker Backend Sidecar")
    parser.add_argument("--data-dir", type=str, default="./data", help="Application data directory")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host interface to bind")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind (0 for OS-assigned in sidecar mode)")
    parser.add_argument("--parent-pid", type=int, default=None, help="Parent process ID for watchdog")
    parser.add_argument("--shutdown-grace", type=int, default=5, help="Shutdown grace period in seconds")
    parser.add_argument("--log-level", type=str, default="info", help="Log level (debug, info, warning, error)")

    parsed, _ = parser.parse_known_args(argv)
    data_dir = Path(parsed.data_dir).resolve()
    data_dir.mkdir(parents=True, exist_ok=True)

    return RuntimeArgs(
        data_dir=data_dir,
        host=parsed.host,
        port=parsed.port,
        parent_pid=parsed.parent_pid,
        shutdown_grace=parsed.shutdown_grace,
        log_level=parsed.log_level,
    )
