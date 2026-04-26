from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from api.app.eventing.idempotency import ProcessedEventRepository


class NotificationDispatcher:
    """Idempotent event consumer for WhatsApp and email notifications."""

    def __init__(self, db: AsyncSession, consumer_name: str = "notifications"):
        self.db = db
        self.processed_repo = ProcessedEventRepository(db)
        self.consumer_name = consumer_name

    async def handle_event(self, event: dict[str, Any]) -> str:
        event_id = str(event["event_id"])
        event_type = str(event["event_type"])

        if await self.processed_repo.is_processed(self.consumer_name, event_id):
            return "duplicate_ignored"

        if event_type == "AppointmentCreated":
            await self._send_whatsapp_confirmation(event)
            await self._send_email_confirmation(event)
        elif event_type == "AppointmentCancelled":
            await self._send_whatsapp_cancellation(event)
            await self._send_email_cancellation(event)

        await self.processed_repo.mark_processed(self.consumer_name, event_id)
        await self.db.commit()
        return "processed"

    async def _send_whatsapp_confirmation(self, event: dict[str, Any]) -> None:
        # Integrate with existing WhatsApp gateway here.
        _ = event

    async def _send_email_confirmation(self, event: dict[str, Any]) -> None:
        # Integrate with SMTP/provider adapter here.
        _ = event

    async def _send_whatsapp_cancellation(self, event: dict[str, Any]) -> None:
        _ = event

    async def _send_email_cancellation(self, event: dict[str, Any]) -> None:
        _ = event
