"""Desktop sidecar CLI entrypoint for JobSeeker (§4.1).

Parses CLI arguments, binds an OS-assigned port (when port 0), generates
per-launch bearer token, starts parent PID watchdog, emits AUTOJOB_READY handshake,
and runs uvicorn server.
"""

from __future__ import annotations

import asyncio
import os
import socket
import sys
import uvicorn

from app.main import create_app
from app.runtime.args import parse_args
from app.runtime.handshake import emit_handshake
from app.runtime.token import generate_token
from app.runtime.watchdog import start_watchdog


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main():
    args = parse_args(sys.argv[1:])

    # Port assignment
    port = args.port
    if port == 0:
        port = find_free_port()

    # Generate per-launch bearer token
    token = generate_token()

    # Configure environment
    os.environ["AUTOJOB_RUNTIME_MODE"] = "sidecar"
    os.environ["AUTOJOB_DATA_DIR"] = str(args.data_dir)
    os.environ["AUTOJOB_HOST"] = args.host
    os.environ["AUTOJOB_PORT"] = str(port)
    os.environ["AUTOJOB_TOKEN"] = token
    os.environ["AUTOJOB_ENFORCE_TOKEN"] = "true"

    # Create app configured with token & port security
    app_instance = create_app(token=token, port=port, enforce_token=True)

    config = uvicorn.Config(
        app=app_instance,
        host=args.host,
        port=port,
        log_level=args.log_level,
        access_log=False,
    )
    server = uvicorn.Server(config)

    async def _run():
        # Start parent watchdog if specified
        if args.parent_pid:
            asyncio.create_task(start_watchdog(args.parent_pid))

        # Emit handshake before serving
        emit_handshake(port=port, token=token, version="2.0.0")

        await server.serve()

    try:
        asyncio.run(_run())
        sys.exit(0)
    except KeyboardInterrupt:
        sys.exit(0)
    except Exception as exc:
        sys.stderr.write(f"Sidecar fatal error: {exc}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
