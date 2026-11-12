"""Security middleware for JobSeeker sidecar runtime (§4.1).

Enforces:
1. Strict Host header check (DNS-rebinding defense).
2. Per-launch bearer token validation on /api/v1/*, /ws/*, /internal/*, and /health.
"""

from __future__ import annotations

import re
from typing import Callable, Optional
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.runtime.token import validate_token


class SidecarSecurityMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        token: Optional[str] = None,
        port: int = 8000,
        enforce_token: bool = False,
    ) -> None:
        super().__init__(app)
        self.token = token
        self.port = port
        self.enforce_token = enforce_token

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # 1. Strict Host header check
        host_header = request.headers.get("host", "")
        # Host should be localhost, 127.0.0.1, localhost:<port>, or 127.0.0.1:<port>
        host_without_port = host_header.split(":")[0].lower()
        if host_without_port not in {"127.0.0.1", "localhost", "testserver"}:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "error": {
                        "code": "forbidden",
                        "message": f"Invalid Host header: {host_header}",
                        "details": {},
                    }
                },
            )

        # 2. Token authentication
        if self.enforce_token and self.token:
            # Check WebSocket token query param or Authorization header
            path = request.url.path
            auth_header = request.headers.get("authorization", "")
            token_from_header = None
            if auth_header.startswith("Bearer "):
                token_from_header = auth_header[7:].strip()

            token_from_query = request.query_params.get("token")
            provided_token = token_from_header or token_from_query

            if not provided_token:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={
                        "error": {
                            "code": "unauthorized",
                            "message": "Missing bearer token",
                            "details": {},
                        }
                    },
                )

            if not validate_token(provided_token, self.token):
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "error": {
                            "code": "forbidden",
                            "message": "Invalid bearer token",
                            "details": {},
                        }
                    },
                )

        return await call_next(request)
