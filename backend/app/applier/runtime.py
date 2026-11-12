"""Dedicated Automation Browser Runtime Manager (§3, §12).

Manages a dedicated Chrome persistent context with persistent storage state.
No extension, no CDP attach to daily Chrome. Visible window on user desktop.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any

from playwright.async_api import BrowserContext, Page, Playwright, async_playwright

from app.config import get_settings
from app.schemas.health import BrowserHealth

logger = logging.getLogger(__name__)


class BrowserRuntimeManager:
    """Singleton manager for the dedicated automation browser context."""

    _instance: BrowserRuntimeManager | None = None

    def __init__(self) -> None:
        self._playwright: Playwright | None = None
        self._context: BrowserContext | None = None
        self._lock = asyncio.Lock()
        self._is_running = False

    @classmethod
    def get_instance(cls) -> BrowserRuntimeManager:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @property
    def is_running(self) -> bool:
        return self._is_running and self._context is not None

    async def get_status(self) -> BrowserHealth:
        """Probe browser status and logged-in platforms."""
        settings = get_settings()
        profile_path = str(settings.data_dir / "browser_profile")
        logged_in: dict[str, bool] = {"linkedin": False, "greenhouse": False, "lever": False, "workday": False}

        if self.is_running and self._context:
            try:
                cookies = await self._context.cookies()
                for c in cookies:
                    domain = c.get("domain", "").lower()
                    if "linkedin.com" in domain and c.get("name") == "li_at":
                        logged_in["linkedin"] = True
                    if "greenhouse.io" in domain:
                        logged_in["greenhouse"] = True
                    if "lever.co" in domain:
                        logged_in["lever"] = True
                    if "myworkdayjobs.com" in domain:
                        logged_in["workday"] = True
            except Exception as e:
                logger.warning("Failed to probe browser cookies: %s", e)

        return BrowserHealth(
            status="RUNNING" if self.is_running else "STOPPED",
            profile_path=profile_path,
            active_pages=len(self._context.pages) if self._context else 0,
            logged_in_platforms=logged_in,
        )

    async def get_or_launch_context(self, headless_override: bool | None = None) -> BrowserContext:
        """Get active browser context or launch persistent context."""
        async with self._lock:
            if self._context is not None and self._is_running:
                return self._context

            settings = get_settings()
            profile_dir = settings.data_dir / "browser_profile"
            profile_dir.mkdir(parents=True, exist_ok=True)

            headless = headless_override
            if headless is None:
                env_hl = os.getenv("AUTOJOB_HEADLESS", "").lower().strip()
                if env_hl in ("1", "true", "yes"):
                    headless = True
                elif env_hl in ("0", "false", "no"):
                    headless = False
                else:
                    headless = getattr(settings, "browser_headless", False)

            self._playwright = await async_playwright().start()
            self._context = await self._playwright.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=headless,
                viewport={"width": 1280, "height": 900},
                args=[
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--disable-blink-features=AutomationControlled",
                ],
            )
            self._is_running = True
            logger.info("Launched dedicated automation browser (headless=%s) at %s", headless, profile_dir)
            return self._context

    async def new_page(self, headless_override: bool | None = None) -> Page:
        """Create and return a new browser page."""
        ctx = await self.get_or_launch_context(headless_override=headless_override)
        return await ctx.new_page()

    async def close(self) -> None:
        """Close browser context and stop playwright."""
        async with self._lock:
            if self._context:
                try:
                    await self._context.close()
                except Exception as e:
                    logger.warning("Error closing browser context: %s", e)
                self._context = None
            if self._playwright:
                try:
                    await self._playwright.stop()
                except Exception as e:
                    logger.warning("Error stopping playwright: %s", e)
                self._playwright = None
            self._is_running = False
            logger.info("Dedicated automation browser closed.")


def get_browser_manager() -> BrowserRuntimeManager:
    return BrowserRuntimeManager.get_instance()
