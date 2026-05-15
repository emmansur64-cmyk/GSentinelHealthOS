from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.core import validate_api_key
from api.app.db.session import get_db
from api.app.services.google_calendar_service import GoogleCalendarService
from api.app.services.google_calendar_webhook_service import GoogleCalendarWebhookService
from shared.utils import setup_logger

router = APIRouter(prefix="/webhooks/google-calendar", tags=["webhooks-google-calendar"])
logger = setup_logger(__name__)


class GoogleWatchStartRequest(BaseModel):
    calendar_id: Optional[str] = None


class GoogleWatchStartResponse(BaseModel):
    success: bool
    channel_id: Optional[str] = None
    resource_id: Optional[str] = None
    expiration: Optional[str] = None
    message: str = ""


class GoogleWatchStopResponse(BaseModel):
    success: bool
    channel_id: Optional[str] = None
    message: str = ""


@router.post("/watch/start", response_model=GoogleWatchStartResponse, status_code=status.HTTP_200_OK)
async def start_google_calendar_watch(
    request: GoogleWatchStartRequest,
    db: AsyncSession = Depends(get_db),
    _auth: Any = Depends(validate_api_key),
) -> GoogleWatchStartResponse:
    service = GoogleCalendarService(db)
    result = await service.start_watch_channel(calendar_id=request.calendar_id)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message or "watch_start_failed")

    return GoogleWatchStartResponse(
        success=True,
        channel_id=result.channel_id,
        resource_id=result.resource_id,
        expiration=result.expiration.isoformat() if result.expiration else None,
        message=result.message,
    )


@router.post("/watch/stop/{channel_id}", response_model=GoogleWatchStopResponse, status_code=status.HTTP_200_OK)
async def stop_google_calendar_watch(
    channel_id: str,
    db: AsyncSession = Depends(get_db),
    _auth: Any = Depends(validate_api_key),
) -> GoogleWatchStopResponse:
    service = GoogleCalendarService(db)
    result = await service.stop_watch_channel(channel_id)
    if not result.success:
        raise HTTPException(status_code=404, detail=result.message or "watch_channel_not_found")

    return GoogleWatchStopResponse(success=True, channel_id=result.channel_id, message=result.message)


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def receive_google_calendar_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_goog_channel_id: Optional[str] = Header(None, alias="X-Goog-Channel-ID"),
    x_goog_resource_id: Optional[str] = Header(None, alias="X-Goog-Resource-ID"),
    x_goog_resource_state: Optional[str] = Header(None, alias="X-Goog-Resource-State"),
    x_goog_message_number: Optional[str] = Header(None, alias="X-Goog-Message-Number"),
    x_goog_channel_token: Optional[str] = Header(None, alias="X-Goog-Channel-Token"),
) -> dict[str, Any]:
    webhook_service = GoogleCalendarWebhookService(db)

    try:
        channel = await webhook_service.validate_headers(
            channel_id=x_goog_channel_id,
            resource_id=x_goog_resource_id,
            resource_state=x_goog_resource_state,
            message_number=x_goog_message_number,
            webhook_token=x_goog_channel_token,
        )
    except ValueError as exc:
        logger.warning("google_calendar_webhook_invalid: %s", exc)
        raise HTTPException(status_code=403, detail="Webhook de Google Calendar invalido")

    # Google sends an initial "sync" state to acknowledge channel creation.
    if (x_goog_resource_state or "").lower() == "sync":
        await db.commit()
        return {
            "accepted": True,
            "state": "sync",
            "channel_id": x_goog_channel_id,
            "received_at": datetime.utcnow().isoformat(),
        }

    _ = await request.body()  # Payload is typically empty for Calendar push notifications.
    summary = await webhook_service.sync_channel_changes(channel)

    return {
        "accepted": True,
        "state": x_goog_resource_state,
        "channel_id": x_goog_channel_id,
        "summary": summary,
        "received_at": datetime.utcnow().isoformat(),
    }
