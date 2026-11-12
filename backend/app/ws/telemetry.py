"""WebSocket telemetry server for JobSeeker (§8)."""

from __future__ import annotations

import collections
import json
import logging
from typing import Any, Dict, List, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(tags=["telemetry"])


class TelemetryHub:
    def __init__(self, buffer_size: int = 50) -> None:
        self.active_connections: Set[WebSocket] = set()
        self.ring_buffer: collections.deque[Dict[str, Any]] = collections.deque(maxlen=buffer_size)

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.discard(websocket)

    async def broadcast(self, event_or_dict: str | Dict[str, Any], payload: Dict[str, Any] | None = None) -> None:
        if isinstance(event_or_dict, dict):
            event_type = event_or_dict.get("event") or event_or_dict.get("type") or "EVENT"
            p = {k: v for k, v in event_or_dict.items() if k not in ("event", "type")}
            message = {"type": event_type, "payload": p}
        else:
            message = {"type": event_or_dict, "payload": payload or {}}
        self.ring_buffer.append(message)
        dead = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception as exc:
                logger.debug("Failed to send WS message, disconnecting: %s", exc)
                dead.append(connection)
        for d in dead:
            self.disconnect(d)

    async def replay_buffer(self, websocket: WebSocket) -> None:
        for message in list(self.ring_buffer):
            try:
                await websocket.send_json(message)
            except Exception:
                break


hub = TelemetryHub(buffer_size=50)
telemetry_hub = hub


@router.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket, token: str | None = None):
    # Sidecar mode: reject unauthenticated telemetry subscriptions (audit P1-4).
    # QA answers and application status are sensitive; the spec requires
    # Bearer/?token= on /ws/* exactly like HTTP.
    from app.runtime.token import validate_token

    expected = getattr(websocket.app.state, "sidecar_token", None)
    enforce = getattr(websocket.app.state, "enforce_token", False)
    if enforce and expected:
        provided = token
        if not provided:
            auth = websocket.headers.get("authorization", "")
            if auth.startswith("Bearer "):
                provided = auth[len("Bearer "):]
        if not validate_token(provided, expected):
            await websocket.close(code=4401)
            return
    await hub.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type")
                if msg_type == "PING":
                    await websocket.send_json({"type": "PONG"})
                elif msg_type == "RESYNC":
                    await hub.replay_buffer(websocket)
            except Exception:
                pass
    except WebSocketDisconnect:
        hub.disconnect(websocket)
    except Exception as exc:
        logger.debug("WebSocket error: %s", exc)
        hub.disconnect(websocket)
