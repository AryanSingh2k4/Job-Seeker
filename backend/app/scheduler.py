"""Asyncio background schedulers for JobSeeker (§6.5)."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import List

logger = logging.getLogger(__name__)

_TASKS: List[asyncio.Task] = []


def _load_crawl_settings(db) -> tuple[int, int]:
    """(interval_minutes, max_companies_per_day) from system_settings row."""
    from app.models.settings import AppSetting
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "system_settings").first()
        if row:
            data = json.loads(row.value)
            return (
                max(1, int(data.get("crawl_interval_minutes", 5))),
                max(1, int(data.get("crawl_max_companies_per_day", 50))),
            )
    except Exception as exc:
        logger.warning("crawl settings load failed, using defaults: %s", exc)
    return 5, 50


def _companies_crawled_today(db) -> int:
    """Distinct companies with jobs discovered since local midnight."""
    from datetime import timedelta
    from app.models.job import Job
    try:
        midnight = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        rows = (
            db.query(Job.company)
            .filter(Job.date_discovered >= midnight - timedelta(hours=14))
            .distinct()
            .all()
        )
        return len({r[0] for r in rows})
    except Exception as exc:
        logger.warning("daily company count failed: %s", exc)
        return 0


async def crawl_loop(db_session_factory) -> None:
    """Periodic discovery sweep — interval and daily company cap from settings."""
    from app.crawler.service import run_crawler_sweep
    logger.info("crawl_loop started (interval + cap read from settings each cycle)")
    while True:
        try:
            db = db_session_factory()
            try:
                interval_min, daily_cap = _load_crawl_settings(db)
                crawled_today = _companies_crawled_today(db)
                remaining = max(0, daily_cap - crawled_today)
                if remaining == 0:
                    logger.info("daily company cap reached (%d) — sweep skipped", daily_cap)
                else:
                    result = await run_crawler_sweep(db, company_limit=remaining)
                    logger.info(
                        "sweep done: new=%s dup=%s filtered=%s (companies used %d/%d)",
                        result.get("sweepId"), result.get("new_jobs"),
                        result.get("filtered"), min(remaining, daily_cap), daily_cap,
                    )
            finally:
                db.close()
            await asyncio.sleep(interval_min * 60)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Error in crawl_loop: %s", exc)
            await asyncio.sleep(300)


async def match_loop(interval_seconds: int = 10) -> None:
    logger.info("Starting match loop with interval %d seconds", interval_seconds)
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            # Matcher worker processes score_queued jobs here
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Error in match_loop: %s", exc)


async def apply_loop(interval_seconds: int = 30) -> None:
    logger.info("Starting apply loop with interval %d seconds", interval_seconds)
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            # Applier worker processes ready_to_apply jobs here
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Error in apply_loop: %s", exc)


def start_schedulers(db_session_factory=None) -> None:
    """Create and register all background tasks (idempotent)."""
    if _TASKS:
        return
    from app.db import SessionLocal
    factory = db_session_factory or SessionLocal
    _TASKS.append(asyncio.create_task(crawl_loop(factory)))
    _TASKS.append(asyncio.create_task(match_loop()))
    _TASKS.append(asyncio.create_task(apply_loop()))
    logger.info("scheduler: %d background tasks started", len(_TASKS))


def stop_schedulers() -> None:
    for t in _TASKS:
        t.cancel()
    _TASKS.clear()
