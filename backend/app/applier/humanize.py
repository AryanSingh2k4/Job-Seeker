"""Humanization and behavioral jitter utilities (§7.3, §12).

Simulates human-like typing delays, micro-pauses, and reading dwells.
In test or fast mode (AUTOJOB_HUMANIZE=0), sleeps are bypassed.
"""

from __future__ import annotations

import asyncio
import os
import random
from typing import Any

from playwright.async_api import ElementHandle, Locator, Page


def is_humanize_enabled() -> bool:
    """Check if artificial human-like delays should run."""
    val = os.getenv("AUTOJOB_HUMANIZE", "1").lower().strip()
    return val not in ("0", "false", "no", "off")


async def jitter_sleep(min_s: float, max_s: float, fast_mode: bool = False) -> None:
    """Sleep for random seconds between min_s and max_s if humanize is enabled."""
    if fast_mode or not is_humanize_enabled():
        return
    delay = random.uniform(min_s, max_s)
    await asyncio.sleep(delay)


async def human_type(
    locator: Locator,
    text: str,
    fast_mode: bool = False,
) -> None:
    """Type text character-by-character with 60-180ms jitter and micro-pauses."""
    if fast_mode or not is_humanize_enabled():
        await locator.fill(text)
        return

    await locator.focus()
    await locator.fill("")  # Clear existing

    for char in text:
        delay = random.uniform(0.06, 0.18)
        # 5% chance of thinking pause
        if random.random() < 0.05:
            delay += random.uniform(0.2, 0.4)
        await locator.type(char, delay=int(delay * 1000))


async def field_to_field_delay(fast_mode: bool = False) -> None:
    """Delay between form fields (1.2 to 3.5 seconds)."""
    await jitter_sleep(1.2, 3.5, fast_mode=fast_mode)


async def page_dwell_delay(fast_mode: bool = False) -> None:
    """Reading dwell delay on page load (12 to 45 seconds)."""
    await jitter_sleep(12.0, 45.0, fast_mode=fast_mode)
