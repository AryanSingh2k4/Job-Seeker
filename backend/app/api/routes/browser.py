"""Browser management routes for JobSeeker (§7.5)."""

from __future__ import annotations

import os
from fastapi import APIRouter
from app.applier.runtime import get_browser_manager
from app.config import get_settings
from app.schemas.settings import BrowserStatusResponse

router = APIRouter(prefix="/browser", tags=["browser"])


@router.get("/status", response_model=BrowserStatusResponse)
async def get_browser_status() -> BrowserStatusResponse:
    settings = get_settings()
    manager = get_browser_manager()
    status = await manager.get_status()
    return BrowserStatusResponse(
        running=manager.is_running,
        executable=os.environ.get("AUTOJOB_BROWSER_EXECUTABLE"),
        profile_path=status.profile_path,
        logged_in=status.logged_in_platforms,
    )


@router.post("/launch", response_model=BrowserStatusResponse)
async def launch_browser() -> BrowserStatusResponse:
    manager = get_browser_manager()
    await manager.get_or_launch_context()
    return await get_browser_status()


@router.post("/close", response_model=BrowserStatusResponse)
async def close_browser() -> BrowserStatusResponse:
    manager = get_browser_manager()
    await manager.close()
    return await get_browser_status()
