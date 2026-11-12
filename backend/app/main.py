"""Main FastAPI application for JobSeeker (§7)."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.applications import router as applications_router
from app.api.routes.browser import router as browser_router
from app.api.routes.health import router as health_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.matcher import router as matcher_router
from app.api.routes.profile import router as profile_router
from app.api.routes.settings import router as settings_router
from app.errors import (
    AppException,
    app_exception_handler,
    generic_exception_handler,
    validation_exception_handler,
)
from app.runtime.middleware import SidecarSecurityMiddleware
from app.runtime.shutdown import router as shutdown_router
from app.scheduler import start_schedulers, stop_schedulers
from app.ws.telemetry import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_schedulers()
    yield
    # Shutdown
    stop_schedulers()


def create_app(token: str | None = None, port: int = 8000, enforce_token: bool = False) -> FastAPI:
    app = FastAPI(
        title="JobSeeker API",
        version="2.0.0",
        description="JobSeeker local desktop application sidecar API",
        lifespan=lifespan,
    )

    # 1. Error handlers
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)

    # 2. CORS middleware (Frozen: desktop origins + dev origins)
    cors_origins = [
        "http://tauri.localhost",
        "https://tauri.localhost",
        "tauri://localhost",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        # local dev servers on alternate ports (3010/3011/…) — loopback only
        "http://localhost:3010", "http://127.0.0.1:3010",
        "http://localhost:3011", "http://127.0.0.1:3011",
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 3. Security middleware (Bearer token + strict Host header check)
    app.add_middleware(
        SidecarSecurityMiddleware,
        token=token,
        port=port,
        enforce_token=enforce_token,
    )

    # 4. Mount routes
    # Root /health and /api/v1/health alias
    app.include_router(health_router)
    app.include_router(health_router, prefix="/api/v1")
    # Sidecar shutdown (/internal/shutdown)
    app.include_router(shutdown_router)
    # WebSocket telemetry (/ws/telemetry)
    app.include_router(ws_router)

    # API v1 prefix routes
    app.include_router(profile_router, prefix="/api/v1")
    app.include_router(jobs_router, prefix="/api/v1")
    app.include_router(matcher_router, prefix="/api/v1")
    app.include_router(applications_router, prefix="/api/v1")
    app.include_router(browser_router, prefix="/api/v1")
    app.include_router(settings_router, prefix="/api/v1")

    return app


# Default app instance for dev / uvicorn app.main:app
token_env = os.environ.get("AUTOJOB_TOKEN")
enforce_token_env = os.environ.get("AUTOJOB_ENFORCE_TOKEN", "false").lower() == "true"
port_env = int(os.environ.get("AUTOJOB_PORT", 8000))

app = create_app(token=token_env, port=port_env, enforce_token=enforce_token_env)
