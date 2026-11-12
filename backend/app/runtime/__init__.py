"""Runtime package for JobSeeker sidecar lifecycle."""

from app.runtime.args import RuntimeArgs, parse_args
from app.runtime.token import generate_token, validate_token
from app.runtime.middleware import SidecarSecurityMiddleware
from app.runtime.handshake import emit_handshake
from app.runtime.watchdog import start_watchdog
from app.runtime.shutdown import router as shutdown_router

__all__ = [
    "RuntimeArgs",
    "parse_args",
    "generate_token",
    "validate_token",
    "SidecarSecurityMiddleware",
    "emit_handshake",
    "start_watchdog",
    "shutdown_router",
]
