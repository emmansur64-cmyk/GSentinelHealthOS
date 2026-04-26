"""Periodic reconciliation between local appointments and Google Calendar."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, cast

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.models import Appointment
from api.app.services.google_calendar_service import GoogleCalendarService
from shared.utils import setup_logger


logger = setup_logger(__name__)


@dataclass
class ReconciliationSummary:
    scanned: int = 0
    inconsistencies_detected: int = 0
    corrected: int = 0
    failed: int = 0
    recreated_missing_event_id: int = 0
    recreated_missing_remote: int = 0
    deleted_cancelled_remote: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "scanned": self.scanned,
            "inconsistencies_detected": self.inconsistencies_detected,
            "corrected": self.corrected,
            "failed": self.failed,
            "recreated_missing_event_id": self.recreated_missing_event_id,
            "recreated_missing_remote": self.recreated_missing_remote,
            "deleted_cancelled_remote": self.deleted_cancelled_remote,
        }


class GoogleCalendarReconciliationService:
    """Detects and fixes DB <-> Google Calendar drifts for recent appointments."""

    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.calendar = GoogleCalendarService(db_session)

    async def _recent_appointments(self, hours: int, limit: int) -> list[Appointment]:
        cutoff = datetime.utcnow() - timedelta(hours=max(1, hours))
        stmt = (
            select(Appointment)
            .where(
                and_(
                    Appointment.updated_at >= cutoff,
                    Appointment.status.in_(["scheduled", "cancelled"]),
                )
            )
            .order_by(Appointment.updated_at.desc())
            .limit(limit)
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def reconcile_recent(self, hours: int = 48, limit: int = 500) -> ReconciliationSummary:
        summary = ReconciliationSummary()
        appointments = await self._recent_appointments(hours=hours, limit=limit)
        summary.scanned = len(appointments)

        for appointment in appointments:
            appointment_id = cast(Any, appointment.id)
            status = str(cast(Any, appointment.status) or "").lower()
            google_event_id = cast(Any, appointment.google_event_id)

            try:
                if status == "scheduled":
                    if not google_event_id:
                        summary.inconsistencies_detected += 1
                        result = await self.calendar.create_event_for_appointment(appointment_id)
                        if result.success:
                            await self.db.commit()
                            summary.corrected += 1
                            summary.recreated_missing_event_id += 1
                            logger.info(
                                "google_reconcile_recreated_missing_event_id",
                                extra={"appointment_id": str(appointment_id), "event_id": result.event_id},
                            )
                        else:
                            await self.db.rollback()
                            summary.failed += 1
                        continue

                    exists = await self.calendar.event_exists(str(google_event_id))
                    if not exists:
                        summary.inconsistencies_detected += 1
                        appointment.google_event_id = cast(Any, None)
                        appointment.google_sync_status = cast(Any, "pending")
                        await self.db.flush()

                        result = await self.calendar.create_event_for_appointment(appointment_id)
                        if result.success:
                            await self.db.commit()
                            summary.corrected += 1
                            summary.recreated_missing_remote += 1
                            logger.info(
                                "google_reconcile_recreated_missing_remote_event",
                                extra={"appointment_id": str(appointment_id), "event_id": result.event_id},
                            )
                        else:
                            await self.db.rollback()
                            summary.failed += 1

                elif status == "cancelled" and google_event_id:
                    exists = await self.calendar.event_exists(str(google_event_id))
                    if exists:
                        summary.inconsistencies_detected += 1
                        result = await self.calendar.delete_event_for_appointment(appointment_id)
                        if result.success:
                            await self.db.commit()
                            summary.corrected += 1
                            summary.deleted_cancelled_remote += 1
                            logger.info(
                                "google_reconcile_deleted_cancelled_remote_event",
                                extra={"appointment_id": str(appointment_id), "event_id": google_event_id},
                            )
                        else:
                            await self.db.rollback()
                            summary.failed += 1
            except Exception as exc:
                await self.db.rollback()
                summary.failed += 1
                logger.warning(
                    "google_reconcile_item_failed",
                    extra={"appointment_id": str(appointment_id), "error": str(exc)},
                )

        logger.info("google_reconcile_summary", extra=summary.as_dict())
        return summary
