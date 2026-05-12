from __future__ import annotations

from fastapi import APIRouter, Cookie, WebSocket, WebSocketDisconnect, status

from api.app.eventing.realtime_notifications import realtime_notification_manager
from api.app.core.security import AUTH_COOKIE_NAME, verify_jwt_token

router = APIRouter(prefix="/ws", tags=["realtime"])


@router.websocket("/notifications")
async def notifications_websocket(
    websocket: WebSocket,
    gs_access_token: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME),
) -> None:
    if not gs_access_token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing authentication")
        return
    try:
        verify_jwt_token(gs_access_token)
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or missing JWT token")
        return

    await realtime_notification_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await realtime_notification_manager.disconnect(websocket)
    except Exception:
        await realtime_notification_manager.disconnect(websocket)
