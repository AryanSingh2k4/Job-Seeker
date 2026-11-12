"""Graceful shutdown endpoint for JobSeeker sidecar (§4.1)."""

from __future__ import annotations

import asyncio
import os
import signal
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post("/shutdown", status_code=status.HTTP_202_ACCEPTED)
async def shutdown_sidecar() -> JSONResponse:
    """Trigger graceful shutdown of the sidecar process."""
    async def _terminate():
        await asyncio.sleep(0.5)
        # On Windows / Unix send terminate signal
        os.kill(os.getpid(), signal.SIGTERM)

    asyncio.create_task(_terminate())
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"status": "shutting_down"},
    )
