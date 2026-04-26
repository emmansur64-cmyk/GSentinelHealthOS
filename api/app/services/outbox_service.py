"""Servicios para encolar y despachar eventos de notification_outbox."""

from __future__ import annotations

from datetime import datetime, timedelta
import logging
from typing import Any, cast
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.models import Appointment, GoogleOutbox, NotificationOutbox
from api.app.services.google_calendar_service import GoogleCalendarService
from api.app.services.notification_service import notify_appointment_confirmation
from shared.utils import log_structured, setup_logger


logger = setup_logger(__name__)


class OutboxService:
    """Gestiona eventos de integracion bajo patron Outbox."""

    MAX_ATTEMPTS = 5
    MAX_GOOGLE_RETRIES = 8

    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    async def _set_google_sync_status(self, appointment_id: UUID, sync_status: str) -> None:
        appointment = await self.db.scalar(
            select(Appointment).where(Appointment.id == appointment_id)
        )
        if appointment is None:
            return
        appointment.google_sync_status = cast(Any, sync_status)

    async def _get_appointment(self, appointment_id: UUID) -> Appointment | None:
        return await self.db.scalar(select(Appointment).where(Appointment.id == appointment_id))

    async def _validate_google_sync_candidate(self, action: str, appointment_id: UUID) -> tuple[bool, str]:
        """Validate appointment eligibility for Google sync.

        Rules:
        - Google sync is appointment-driven only.
        - Blocked/available slots are never enqueued directly.
        - create/update: cancelled appointments must not be synced.
        - delete: requires an appointment with an existing google_event_id.
        """
        appointment = await self._get_appointment(appointment_id)
        if appointment is None:
            return (False, "appointment_not_found")

        status = str(cast(Any, appointment.status) or "").lower()
        google_event_id = cast(Any, appointment.google_event_id)

        if action in {"create", "update"} and status == "cancelled":
            return (False, "cancelled_appointment_not_syncable")

        if action == "delete" and not google_event_id:
            return (False, "delete_without_google_event_id")

        return (True, "ok")

    async def enqueue_appointment_confirmation(self, appointment_id: UUID, payload: dict[str, Any]) -> None:
        self.db.add(
            NotificationOutbox(
                event_type="appointment.confirmed",
                aggregate_type="appointment",
                aggregate_id=appointment_id,
                payload=payload,
                status="pending",
                attempts=0,
                next_attempt_at=datetime.utcnow(),
            )
        )

    async def _enqueue_google_event(self, event_type: str, appointment_id: UUID, payload: dict[str, Any]) -> None:
        action = event_type.rsplit(".", 1)[-1]
        payload = dict(payload)
        payload.setdefault("entity_type", "appointment")

        is_valid, reason = await self._validate_google_sync_candidate(action, appointment_id)
        if not is_valid:
            log_structured(
                logger,
                logging.INFO,
                "google_sync_enqueue_skipped",
                appointment_id=str(appointment_id),
                outbox_action=action,
                reason=reason,
                payload=payload,
            )
            if action in {"create", "update"}:
                await self._set_google_sync_status(appointment_id, "failed")
            return

        idempotency_key = str(payload.get("idempotency_key") or f"appointment.google.{action}:{appointment_id}")

        existing = await self.db.scalar(
            select(GoogleOutbox.id).where(
                and_(
                    GoogleOutbox.idempotency_key == idempotency_key,
                    GoogleOutbox.status.in_(["pending", "failed"]),
                )
            )
        )
        if existing is not None:
            await self._set_google_sync_status(appointment_id, "pending")
            return

        await self._set_google_sync_status(appointment_id, "pending")

        self.db.add(
            GoogleOutbox(
                appointment_id=appointment_id,
                action=action,
                payload=payload,
                status="pending",
                retries=0,
                next_attempt_at=datetime.utcnow(),
                idempotency_key=idempotency_key,
            )
        )
        log_structured(
            logger,
            logging.INFO,
            "google_outbox_status_transition",
            appointment_id=str(appointment_id),
            outbox_action=action,
            transition="created->pending",
            status="pending",
        )

    async def enqueue_google_create(self, appointment_id: UUID, payload: dict[str, Any]) -> None:
        appointment = await self._get_appointment(appointment_id)
        if appointment is not None and cast(Any, appointment.google_event_id):
            await self._set_google_sync_status(appointment_id, "synced")
            return

        payload = dict(payload)
        payload.setdefault("idempotency_key", f"appointment.google.create:{appointment_id}")
        await self._enqueue_google_event("appointment.google.create", appointment_id, payload)

    async def enqueue_google_update(self, appointment_id: UUID, payload: dict[str, Any]) -> None:
        payload = dict(payload)
        payload.setdefault("idempotency_key", f"appointment.google.update:{appointment_id}")
        await self._enqueue_google_event("appointment.google.update", appointment_id, payload)

    async def enqueue_google_delete(self, appointment_id: UUID, payload: dict[str, Any]) -> None:
        payload = dict(payload)
        payload.setdefault("idempotency_key", f"appointment.google.delete:{appointment_id}")
        await self._enqueue_google_event("appointment.google.delete", appointment_id, payload)

    async def try_dispatch_google_create_after_commit(self, appointment_id: UUID) -> None:
        """Best-effort immediate Google create after DB commit.

        The appointment is already committed at this point. If Google fails, the
        outbox item remains failed/pending for retry and the appointment stays valid.
        """
        item = await self.db.scalar(
            select(GoogleOutbox)
            .where(
                and_(
                    GoogleOutbox.action == "create",
                    GoogleOutbox.appointment_id == appointment_id,
                    GoogleOutbox.status.in_(["pending", "failed"]),
                )
            )
            .order_by(GoogleOutbox.created_at.asc())
            .limit(1)
        )
        if item is None:
            return

        await self.dispatch_google_one(item)
        await self.db.commit()

    async def try_dispatch_google_update_after_commit(self, appointment_id: UUID) -> None:
        """Best-effort immediate Google update after DB commit."""
        item = await self.db.scalar(
            select(GoogleOutbox)
            .where(
                and_(
                    GoogleOutbox.action == "update",
                    GoogleOutbox.appointment_id == appointment_id,
                    GoogleOutbox.status.in_(["pending", "failed"]),
                )
            )
            .order_by(GoogleOutbox.created_at.asc())
            .limit(1)
        )
        if item is None:
            return

        await self.dispatch_google_one(item)
        await self.db.commit()

    async def try_dispatch_google_delete_after_commit(self, appointment_id: UUID) -> None:
        """Best-effort immediate Google delete after DB commit."""
        item = await self.db.scalar(
            select(GoogleOutbox)
            .where(
                and_(
                    GoogleOutbox.action == "delete",
                    GoogleOutbox.appointment_id == appointment_id,
                    GoogleOutbox.status.in_(["pending", "failed"]),
                )
            )
            .order_by(GoogleOutbox.created_at.asc())
            .limit(1)
        )
        if item is None:
            return

        await self.dispatch_google_one(item)
        await self.db.commit()

    async def fetch_pending_google(self, limit: int = 100) -> list[GoogleOutbox]:
        now = datetime.utcnow()
        stmt = (
            select(GoogleOutbox)
            .where(
                and_(
                    GoogleOutbox.status == "pending",
                    GoogleOutbox.retries < self.MAX_GOOGLE_RETRIES,
                    GoogleOutbox.next_attempt_at <= now,
                )
            )
            .order_by(GoogleOutbox.id)
            .with_for_update(skip_locked=True)
            .limit(limit)
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def claim_pending_google_batch(self, limit: int = 50) -> list[str]:
        """Claim a batch atomically to avoid duplicate processing across workers.

        Flow:
        1) BEGIN transaction
        2) SELECT ... FOR UPDATE SKIP LOCKED
        3) mark rows as processing
        4) COMMIT
        """
        await self.db.begin()
        try:
            rows = await self.fetch_pending_google(limit=limit)
            if not rows:
                await self.db.commit()
                return []

            claimed_ids: list[str] = []
            now = datetime.utcnow()
            for row in rows:
                previous_status = cast(str, row.status)
                row.status = cast(Any, "processing")
                row.updated_at = cast(Any, now)
                claimed_ids.append(str(row.id))
                log_structured(
                    logger,
                    logging.INFO,
                    "google_outbox_status_transition",
                    appointment_id=str(row.appointment_id),
                    outbox_id=str(row.id),
                    outbox_action=cast(str, row.action),
                    transition=f"{previous_status}->processing",
                    status="processing",
                )

            await self.db.commit()
            return claimed_ids
        except Exception:
            await self.db.rollback()
            raise

    async def _get_processing_google_item(self, item_id: str) -> GoogleOutbox | None:
        stmt = (
            select(GoogleOutbox)
            .where(
                and_(
                    GoogleOutbox.id == item_id,
                    GoogleOutbox.status == "processing",
                )
            )
            .with_for_update()
        )
        return await self.db.scalar(stmt)

    async def process_claimed_google_item(self, item_id: str) -> tuple[bool, bool]:
        """Process a previously claimed item.

        Returns:
            (processed, success)
        """
        await self.db.begin()
        try:
            item = await self._get_processing_google_item(item_id)
            if item is None:
                await self.db.commit()
                return (False, False)

            action = cast(str, item.action)
            appointment_id = UUID(str(item.appointment_id))

            calendar = GoogleCalendarService(self.db)
            if action == "create":
                result = await calendar.create_event_for_appointment(appointment_id)
            elif action == "update":
                result = await calendar.update_event_for_appointment(appointment_id)
            elif action == "delete":
                result = await calendar.delete_event_for_appointment(appointment_id)
            else:
                raise RuntimeError(f"Unsupported google outbox action: {action}")

            if not result.success:
                raise RuntimeError(result.message or "Google Calendar sync failed")

            await self._set_google_sync_status(appointment_id, "synced")
            previous_status = cast(str, item.status)
            item.status = cast(Any, "done")
            item.processed_at = cast(Any, datetime.utcnow())
            item.last_error = cast(Any, None)
            item.updated_at = cast(Any, datetime.utcnow())
            log_structured(
                logger,
                logging.INFO,
                "google_outbox_status_transition",
                appointment_id=str(item.appointment_id),
                outbox_id=str(item.id),
                outbox_action=action,
                transition=f"{previous_status}->done",
                status="done",
            )
            await self.db.commit()
            return (True, True)
        except Exception as exc:
            try:
                item = await self._get_processing_google_item(item_id)
                if item is not None:
                    retries = cast(int, item.retries) + 1
                    item.retries = cast(Any, retries)
                    previous_status = cast(str, item.status)
                    item.status = cast(Any, "failed" if retries >= self.MAX_GOOGLE_RETRIES else "pending")
                    backoff_minutes = min(60, 2 ** min(6, retries))
                    item.next_attempt_at = cast(Any, datetime.utcnow() + timedelta(minutes=backoff_minutes))
                    item.last_error = cast(Any, str(exc))
                    item.updated_at = cast(Any, datetime.utcnow())

                    log_structured(
                        logger,
                        logging.ERROR,
                        "google_outbox_status_transition",
                        appointment_id=str(item.appointment_id),
                        outbox_id=str(item.id),
                        outbox_action=cast(str, item.action),
                        transition=f"{previous_status}->{cast(str, item.status)}",
                        status=cast(str, item.status),
                        error_type=type(exc).__name__,
                        retries=retries,
                        payload=cast(dict[str, Any], item.payload or {}),
                    )

                    try:
                        await self._set_google_sync_status(UUID(str(item.appointment_id)), "failed")
                    except Exception:
                        pass

                await self.db.commit()
            except Exception:
                await self.db.rollback()
                raise
            return (True, False)

    async def dispatch_google_one(self, item: GoogleOutbox) -> None:
        try:
            action = cast(str, item.action)
            appointment_id = UUID(str(item.appointment_id))

            calendar = GoogleCalendarService(self.db)
            if action == "create":
                result = await calendar.create_event_for_appointment(appointment_id)
            elif action == "update":
                result = await calendar.update_event_for_appointment(appointment_id)
            elif action == "delete":
                result = await calendar.delete_event_for_appointment(appointment_id)
            else:
                raise RuntimeError(f"Unsupported google outbox action: {action}")

            if not result.success:
                raise RuntimeError(result.message or "Google Calendar sync failed")

            await self._set_google_sync_status(appointment_id, "synced")
            previous_status = cast(str, item.status)
            item.status = cast(Any, "done")
            item.processed_at = cast(Any, datetime.utcnow())
            item.last_error = cast(Any, None)
            log_structured(
                logger,
                logging.INFO,
                "google_outbox_status_transition",
                appointment_id=str(item.appointment_id),
                outbox_id=str(item.id),
                outbox_action=action,
                transition=f"{previous_status}->done",
                status="done",
            )
        except Exception as exc:
            retries = cast(int, item.retries) + 1
            item.retries = cast(Any, retries)
            previous_status = cast(str, item.status)
            item.status = cast(Any, "failed")
            backoff_minutes = min(60, 2 ** min(6, retries))
            item.next_attempt_at = cast(Any, datetime.utcnow() + timedelta(minutes=backoff_minutes))
            item.last_error = cast(Any, str(exc))
            log_structured(
                logger,
                logging.ERROR,
                "google_outbox_status_transition",
                appointment_id=str(item.appointment_id),
                outbox_id=str(item.id),
                outbox_action=cast(str, item.action),
                transition=f"{previous_status}->failed",
                status="failed",
                error_type=type(exc).__name__,
                retries=retries,
                payload=cast(dict[str, Any], item.payload or {}),
            )
            try:
                await self._set_google_sync_status(UUID(str(item.appointment_id)), "failed")
            except Exception:
                pass
        finally:
            item.updated_at = cast(Any, datetime.utcnow())

    async def dispatch_google_batch(self, limit: int = 100) -> dict[str, int]:
        claimed_ids = await self.claim_pending_google_batch(limit=limit)
        done = 0
        failed = 0
        processed = 0

        for item_id in claimed_ids:
            item_processed, success = await self.process_claimed_google_item(item_id)
            if not item_processed:
                continue
            processed += 1
            if success:
                done += 1
            else:
                failed += 1

        return {"processed": processed, "done": done, "failed": failed}

    async def fetch_pending(self, limit: int = 100) -> list[NotificationOutbox]:
        now = datetime.utcnow()
        stmt = (
            select(NotificationOutbox)
            .where(
                and_(
                    NotificationOutbox.status.in_(["pending", "failed"]),
                    NotificationOutbox.attempts < self.MAX_ATTEMPTS,
                    NotificationOutbox.next_attempt_at <= now,
                )
            )
            .order_by(NotificationOutbox.created_at)
            .limit(limit)
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def dispatch_one(self, item: NotificationOutbox) -> None:
        try:
            event_type = cast(str, item.event_type)
            if event_type == "appointment.confirmed":
                await notify_appointment_confirmation(cast(dict[str, Any], item.payload))
            elif event_type.startswith("appointment.google."):
                # Legacy compatibility path; new flow uses dedicated google_outbox.
                item.status = cast(Any, "sent")
                item.last_error = cast(Any, "legacy_google_event_migrated_to_google_outbox")
                item.sent_at = cast(Any, datetime.utcnow())
                return

            item.status = cast(Any, "sent")
            item.sent_at = cast(Any, datetime.utcnow())
            item.last_error = cast(Any, None)
        except Exception as exc:
            attempts = cast(int, item.attempts) + 1
            item.attempts = cast(Any, attempts)
            item.status = cast(Any, "failed")
            # Backoff exponencial con tope para fallos de red y rate limits.
            backoff_minutes = min(60, 2 ** min(6, attempts))
            item.next_attempt_at = cast(Any, datetime.utcnow() + timedelta(minutes=backoff_minutes))
            item.last_error = cast(Any, str(exc))
        finally:
            item.updated_at = cast(Any, datetime.utcnow())

    async def dispatch_batch(self, limit: int = 100) -> dict[str, int]:
        pending = await self.fetch_pending(limit=limit)
        sent = 0
        failed = 0
        for item in pending:
            before = cast(str, item.status)
            await self.dispatch_one(item)
            if cast(str, item.status) == "sent":
                sent += 1
            elif cast(str, item.status) == "failed" and before != "failed":
                failed += 1
        await self.db.commit()
        return {"processed": len(pending), "sent": sent, "failed": failed}
