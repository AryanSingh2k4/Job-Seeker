"""Parent PID watchdog task to prevent orphaned sidecar processes (§4.1)."""

from __future__ import annotations

import asyncio
import logging
import os
import sys

logger = logging.getLogger(__name__)


def is_process_running(pid: int) -> bool:
    """Check if a process exists across Windows and Unix."""
    if pid <= 0:
        return False
    if sys.platform == "win32":
        import ctypes
        kernel32 = ctypes.windll.kernel32
        SYNCHRONIZE = 0x00100000
        handle = kernel32.OpenProcess(SYNCHRONIZE, False, pid)
        if handle:
            kernel32.CloseHandle(handle)
            return True
        return False
    else:
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False


async def start_watchdog(parent_pid: int | None, interval_seconds: float = 2.0) -> None:
    """Poll parent PID every interval_seconds. Exit if parent dies."""
    if not parent_pid:
        return

    logger.info("Starting parent PID watchdog for PID %d", parent_pid)
    while True:
        await asyncio.sleep(interval_seconds)
        if not is_process_running(parent_pid):
            logger.warning("Parent process %d died. Shutting down sidecar.", parent_pid)
            os._exit(0)
