"""CAPTCHA Zero-Bypass Detection and Safe Human-Handoff Engine (§7.4, §12).

Zero-Bypass Policy:
  Never solved, never bypassed, no third-party solver APIs.
  1. Detects presence of challenge via DOM / network signatures.
  2. Freezes automation, emits WS CAPTCHA_CHALLENGE_DETECTED.
  3. Awaits human resolution in the visible browser window (up to 5 min / 300s).
  4. On clearance: resumes automation.
  5. On 5-min AFK timeout: halts cleanly with CAPTCHA_BLOCKED and pauses platform.
"""

from __future__ import annotations

import asyncio
import logging
from playwright.async_api import Page

from app.errors import AppException
from app.ws.telemetry import telemetry_hub

logger = logging.getLogger(__name__)

CAPTCHA_SELECTORS = [
    'iframe[src*="recaptcha"]',
    'iframe[src*="turnstile"]',
    'iframe[src*="arkose"]',
    'iframe[src*="hcaptcha"]',
    'iframe[src*="challenges.cloudflare.com"]',
    'div[id*="captcha"]',
    'div[class*="captcha"]',
    '.g-recaptcha',
    '#captcha-internal',
]


async def detect_captcha(page: Page) -> bool:
    """Check if any CAPTCHA challenge is currently active in the page DOM."""
    for selector in CAPTCHA_SELECTORS:
        try:
            elem = page.locator(selector)
            if await elem.count() > 0 and await elem.first.is_visible():
                return True
        except Exception:
            continue
    return False


async def handle_captcha_challenge(
    page: Page,
    application_id: str,
    job_id: str,
    platform: str,
    timeout_seconds: float = 300.0,
) -> bool:
    """Freeze automation and await human resolution up to timeout_seconds.

    Returns True if solved by human, False if AFK timeout expired.
    """
    logger.warning("CAPTCHA challenge detected on %s for application %s! Freezing automation.", platform, application_id)

    # 1. Emit telemetry
    await telemetry_hub.broadcast({
        "event": "CAPTCHA_CHALLENGE_DETECTED",
        "application_id": application_id,
        "job_id": job_id,
        "platform": platform,
        "timeout_seconds": timeout_seconds,
    })

    # 2. Poll for clearance every 2 seconds
    start_time = asyncio.get_event_loop().time()
    while asyncio.get_event_loop().time() - start_time < timeout_seconds:
        await asyncio.sleep(2.0)
        is_still_present = await detect_captcha(page)
        if not is_still_present:
            logger.info("CAPTCHA cleared by human! Resuming automation.")
            return True

    logger.error("CAPTCHA AFK timeout (5 min) exceeded without resolution.")
    return False
