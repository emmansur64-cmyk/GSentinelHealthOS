from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

from shared.utils import setup_logger

logger = setup_logger(__name__)


class RealtimeNotificationManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def broadcast(self, message: dict[str, Any]) -> None:
        async with self._lock:
            recipients = list(self._connections)

        stale_connections: list[WebSocket] = []
        for websocket in recipients:
            try:
                await websocket.send_json(message)
            except Exception:
                stale_connections.append(websocket)

        if not stale_connections:
            return

        async with self._lock:
            for websocket in stale_connections:
                self._connections.discard(websocket)

    async def reset(self) -> None:
        async with self._lock:
            self._connections.clear()


realtime_notification_manager = RealtimeNotificationManager()


async def broadcast_realtime_event(event_type: str, payload: dict[str, Any]) -> None:
    message = {
        "type": event_type,
        "payload": payload,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await realtime_notification_manager.broadcast(message)
    except Exception:
        logger.exception("realtime_event_broadcast_failed", extra={"event_type": event_type})