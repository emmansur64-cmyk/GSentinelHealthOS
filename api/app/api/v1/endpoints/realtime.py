from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.app.eventing.realtime_notifications import realtime_notification_manager

router = APIRouter(prefix="/ws", tags=["realtime"])


@router.websocket("/notifications")
async def notifications_websocket(websocket: WebSocket) -> None:
    await realtime_notification_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await realtime_notification_manager.disconnect(websocket)
    except Exception:
        await realtime_notification_manager.disconnect(websocket)