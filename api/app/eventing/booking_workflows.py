from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.eventing.outbox import OutboxRepository
from api.app.eventing.schemas import (
    AppointmentCancelledData,
    AppointmentCreatedData,
    DomainEvent,
    SlotReservedData,
)


class BookingWorkflowService:
    """Evented booking workflow using a single DB transaction + Outbox.

    Assumes slot-based schema tables:
    - time_slots(id, doctor_id, status)
    - appointments(id, slot_id, patient_id, status, priority)
    - outbox_events(...)
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.outbox = OutboxRepository(db)

    async def reserve_slot(
        self,
        *,
        slot_id: int,
        patient_id: int,
        correlation_id: UUID | None = None,
        causation_id: UUID | None = None,
        priority: str = "normal",
        reservation_source: str = "api",
    ) -> int:
        correlation_id = correlation_id or uuid4()
        causation_id = causation_id or correlation_id

        await self.db.begin()
        is_postgres = self.db.bind is not None and self.db.bind.dialect.name == "postgresql"
        lock_clause = "FOR UPDATE" if is_postgres else ""
        now_expr = "now()" if is_postgres else "CURRENT_TIMESTAMP"
        try:
            # 1) Lock pessimistic on slot row
            slot_row = (
                await self.db.execute(
                    text(
                        f"""
                        SELECT id, doctor_id, status
                        FROM time_slots
                        WHERE id = :slot_id
                        {lock_clause}
                        """
                    ),
                    {"slot_id": slot_id},
                )
            ).first()

            if slot_row is None:
                raise ValueError("slot_not_found")
            if str(slot_row.status) != "available":
                raise ValueError("slot_not_available")

            # 2) Reserve slot atomically
            updated = (
                await self.db.execute(
                text(
                    """
                    UPDATE time_slots
                    SET status = 'booked'
                    WHERE id = :slot_id
                      AND status = 'available'
                    RETURNING id
                    """
                ),
                {"slot_id": slot_id},
            )
            ).first()
            if updated is None:
                raise ValueError("slot_conflict")

            # 3) Create appointment
            appointment_row = (
                await self.db.execute(
                    text(
                        f"""
                        INSERT INTO appointments (slot_id, patient_id, status, priority, created_at)
                        VALUES (:slot_id, :patient_id, 'scheduled', :priority, {now_expr})
                        RETURNING id
                        """
                    ),
                    {"slot_id": slot_id, "patient_id": patient_id, "priority": priority},
                )
            ).first()
            if appointment_row is None:
                raise RuntimeError("appointment_insert_failed")
            appointment_id = int(appointment_row.id)

            # 4) Insert outbox events in same transaction
            slot_event = DomainEvent(
                event_type="SlotReserved",
                aggregate_type="slot",
                aggregate_id=f"slot:{slot_id}",
                correlation_id=correlation_id,
                causation_id=causation_id,
                data=SlotReservedData(
                    slot_id=slot_id,
                    doctor_id=int(slot_row.doctor_id),
                    patient_id=patient_id,
                    priority=priority,
                    reservation_source=reservation_source,
                ).model_dump(mode="json"),
            )

            appt_event = DomainEvent(
                event_type="AppointmentCreated",
                aggregate_type="appointment",
                aggregate_id=f"appointment:{appointment_id}",
                correlation_id=correlation_id,
                causation_id=slot_event.event_id,
                data=AppointmentCreatedData(
                    appointment_id=appointment_id,
                    slot_id=slot_id,
                    doctor_id=int(slot_row.doctor_id),
                    patient_id=patient_id,
                    status="scheduled",
                ).model_dump(mode="json"),
            )

            await self.outbox.enqueue_many([slot_event, appt_event])
            await self.db.commit()
            return appointment_id

        except Exception:
            await self.db.rollback()
            raise

    async def cancel_appointment(
        self,
        *,
        appointment_id: int,
        reason: str = "patient_request",
        correlation_id: UUID | None = None,
        causation_id: UUID | None = None,
    ) -> int:
        correlation_id = correlation_id or uuid4()
        causation_id = causation_id or correlation_id

        await self.db.begin()
        is_postgres = self.db.bind is not None and self.db.bind.dialect.name == "postgresql"
        lock_clause = "FOR UPDATE" if is_postgres else ""
        try:
            appt_row = (
                await self.db.execute(
                    text(
                        f"""
                        SELECT a.id, a.slot_id, a.patient_id, a.status, ts.doctor_id
                        FROM appointments a
                        JOIN time_slots ts ON ts.id = a.slot_id
                        WHERE a.id = :appointment_id
                        {lock_clause}
                        """
                    ),
                    {"appointment_id": appointment_id},
                )
            ).first()
            if appt_row is None:
                raise ValueError("appointment_not_found")
            if str(appt_row.status) == "cancelled":
                raise ValueError("appointment_already_cancelled")

            await self.db.execute(
                text("UPDATE appointments SET status = 'cancelled' WHERE id = :appointment_id"),
                {"appointment_id": appointment_id},
            )
            await self.db.execute(
                text("UPDATE time_slots SET status = 'available' WHERE id = :slot_id"),
                {"slot_id": int(appt_row.slot_id)},
            )

            cancelled_event = DomainEvent(
                event_type="AppointmentCancelled",
                aggregate_type="appointment",
                aggregate_id=f"appointment:{appointment_id}",
                correlation_id=correlation_id,
                causation_id=causation_id,
                data=AppointmentCancelledData(
                    appointment_id=appointment_id,
                    slot_id=int(appt_row.slot_id),
                    doctor_id=int(appt_row.doctor_id),
                    patient_id=int(appt_row.patient_id),
                    reason=reason,
                ).model_dump(mode="json"),
            )

            await self.outbox.enqueue(cancelled_event)
            await self.db.commit()
            return int(appt_row.slot_id)
        except Exception:
            await self.db.rollback()
            raise
