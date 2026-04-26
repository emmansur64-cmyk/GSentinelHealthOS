"""Inbound webhook sync service for Google Calendar push notifications."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.core.config import settings
from api.app.models import Appointment, GoogleCalendarChannel
from api.app.services.google_calendar_service import GoogleCalendarService
from shared.utils import setup_logger

logger = setup_logger(__name__)


class GoogleCalendarWebhookService:
    """Validates webhook headers and applies incremental inbound sync."""

    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.calendar_service = GoogleCalendarService(db_session)

    async def validate_headers(
        self,
        channel_id: Optional[str],
        resource_id: Optional[str],
        resource_state: Optional[str],
        message_number: Optional[str],
        webhook_token: Optional[str],
    ) -> GoogleCalendarChannel:
        if not channel_id or not resource_id:
            raise ValueError("missing_channel_or_resource_id")
        if not resource_state:
            raise ValueError("missing_resource_state")
        if not message_number:
            raise ValueError("missing_message_number")

        expected_token = (settings.google_calendar_webhook_token or "").strip()
        if expected_token and webhook_token != expected_token:
            raise ValueError("invalid_webhook_token")

        channel = await self.db.scalar(
            select(GoogleCalendarChannel).where(GoogleCalendarChannel.channel_id == channel_id)
        )
        if channel is None:
            raise ValueError("unknown_channel")

        if cast(str, channel.status) != "active":
            raise ValueError("inactive_channel")

        if cast(str, channel.resource_id) != resource_id:
            raise ValueError("resource_mismatch")

        channel.last_notification_at = cast(Any, datetime.utcnow())
        await self.db.flush()
        return channel

    async def sync_channel_changes(self, channel: GoogleCalendarChannel) -> dict[str, int]:
        """Pull changes from Google and reconcile appointment rows."""
        client = self.calendar_service._build_client()  # Reuse authenticated client factory.

        sync_token = cast(Optional[str], cast(Any, channel.last_sync_token))
        kwargs: dict[str, Any] = {
            "calendarId": cast(str, channel.calendar_id),
            "showDeleted": True,
            "singleEvents": True,
            "maxResults": 250,
        }
        if sync_token:
            kwargs["syncToken"] = sync_token
        else:
            kwargs["timeMin"] = datetime.utcnow().isoformat() + "Z"

        applied = 0
        cancelled = 0
        reprogrammed = 0

        while True:
            response = client.events().list(**kwargs).execute()
            items = response.get("items", []) or []

            for event in items:
                event_id = cast(Optional[str], event.get("id"))
                ext_props = cast(dict[str, Any], event.get("extendedProperties") or {})
                private_props = cast(dict[str, Any], ext_props.get("private") or {})
                appointment_id_raw = private_props.get("appointment_id")

                appointment: Optional[Appointment] = None
                if appointment_id_raw:
                    try:
                        appointment_uuid = UUID(str(appointment_id_raw))
                        appointment = await self.db.scalar(
                            select(Appointment).where(Appointment.id == appointment_uuid)
                        )
                    except Exception:
                        appointment = None

                if appointment is None and event_id:
                    appointment = await self.db.scalar(
                        select(Appointment).where(Appointment.google_event_id == event_id)
                    )

                if appointment is None:
                    continue

                if event_id and cast(Optional[str], cast(Any, appointment.google_event_id)) != event_id:
                    appointment.google_event_id = cast(Any, event_id)
                appointment.google_sync_status = cast(Any, "synced")

                if event.get("status") == "cancelled":
                    appointment.status = cast(Any, "cancelled")
                    cancelled += 1
                    applied += 1
                    continue

                start_obj = cast(dict[str, Any], event.get("start") or {})
                start_dt_raw = start_obj.get("dateTime")
                if start_dt_raw:
                    try:
                        parsed_start = datetime.fromisoformat(str(start_dt_raw).replace("Z", "+00:00"))
                        if cast(datetime, appointment.date_time) != parsed_start:
                            appointment.date_time = cast(Any, parsed_start)
                            appointment.status = cast(Any, "reprogrammed")
                            reprogrammed += 1
                            applied += 1
                    except Exception:
                        logger.warning("google_webhook_invalid_datetime", extra={"start": start_dt_raw})

            next_page = response.get("nextPageToken")
            if next_page:
                kwargs["pageToken"] = next_page
                continue

            next_sync_token = response.get("nextSyncToken")
            if next_sync_token:
                channel.last_sync_token = cast(Any, str(next_sync_token))
            break

        await self.db.commit()
        return {
            "applied": applied,
            "cancelled": cancelled,
            "reprogrammed": reprogrammed,
        }
