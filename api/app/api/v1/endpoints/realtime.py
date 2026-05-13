from __future__ import annotations

from fastapi import APIRouter, Cookie, WebSocket, WebSocketDisconnect, status

from api.app.eventing.realtime_notifications import realtime_notification_manager
from api.app.core.security import AUTH_COOKIE_NAME, verify_jwt_token

# Nombre de cookie legacy usado por el frontend Next.js (medical-agenda-saas).
# El backend emite gs_access_token; el frontend almacena auth_token.
# Ambas cookies se aceptan para compatibilidad hasta que el frontend migre.
_FRONTEND_COOKIE_NAME = "auth_token"

router = APIRouter(prefix="/ws", tags=["realtime"])


@router.websocket("/notifications")
async def notifications_websocket(
    websocket: WebSocket,
    gs_access_token: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME),
    auth_token: str | None = Cookie(default=None, alias=_FRONTEND_COOKIE_NAME),
) -> None:
    # Aceptar cualquiera de las dos cookies; gs_access_token tiene prioridad.
    token = gs_access_token or auth_token
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing authentication")
        return
    try:
        verify_jwt_token(token)
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
