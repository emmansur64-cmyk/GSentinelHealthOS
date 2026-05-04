from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from brain.integration.api_client import APIClient
from brain.core.state_manager import StateManager
from shared.utils import setup_logger

logger = setup_logger(__name__)


@dataclass
class ScheduledSlot:
    doctor_id: str
    doctor_name: str
    specialty: str
    appointment_at: datetime
    lock_key: str


class AppointmentSchedulerService:
    """Busca el primer turno disponible por especialidad y lo bloquea temporalmente."""

    def __init__(
        self,
        *,
        api_client: APIClient,
        state_manager: StateManager,
        slot_duration_minutes: int = 30,
        lock_ttl_seconds: int = 300,
        lookahead_days: int = 30,
    ) -> None:
        self.api_client = api_client
        self.state_manager = state_manager
        self.slot_duration_minutes = max(5, slot_duration_minutes)
        self.lock_ttl_seconds = max(60, lock_ttl_seconds)
        self.lookahead_days = max(1, lookahead_days)

    @staticmethod
    def _slot_lock_key(clinic_id: str, doctor_id: str, slot_dt: datetime) -> str:
        return (
            f"clinic:{clinic_id}:slot_lock:{doctor_id}:"
            f"{slot_dt.strftime('%Y-%m-%d')}:{slot_dt.strftime('%H:%M')}"
        )

    async def _try_lock_slot(self, lock_key: str) -> bool:
        redis = self.state_manager.redis_client
        was_set = await redis.set(lock_key, "1", ex=self.lock_ttl_seconds, nx=True)
        return bool(was_set)

    async def release_slot_lock(self, lock_key: str) -> None:
        redis = self.state_manager.redis_client
        await redis.delete(lock_key)

    async def find_next_available_slot(
        self,
        clinic_id: str,
        specialty: str,
        *,
        client_id: str | None = None,
    ) -> ScheduledSlot | None:
        doctors = await self.api_client.list_doctors_by_specialty(
            specialty,
            clinic_id=clinic_id,
            client_id=client_id,
        )
        if not doctors:
            return None

        now = datetime.utcnow().replace(second=0, microsecond=0)
        if now.minute % self.slot_duration_minutes:
            now = now + timedelta(minutes=self.slot_duration_minutes - (now.minute % self.slot_duration_minutes))

        horizon = now + timedelta(days=self.lookahead_days)
        best_candidate: tuple[datetime, dict[str, Any], str] | None = None

        for doctor in doctors:
            doctor_id = str(doctor.get("id") or "").strip()
            if not doctor_id:
                continue

            booked = await self.api_client.get_doctor_appointments(
                doctor_id,
                date_from=now,
                date_to=horizon,
                clinic_id=clinic_id,
                client_id=client_id,
            )
            occupied: set[datetime] = set()
            for item in booked:
                raw_dt = item.get("date_time")
                if not raw_dt:
                    continue
                try:
                    occupied.add(datetime.fromisoformat(str(raw_dt).replace("Z", "+00:00")).replace(tzinfo=None))
                except Exception:
                    continue

            slot = now
            while slot <= horizon:
                if slot.weekday() < 5 and 8 <= slot.hour < 20 and slot not in occupied:
                    lock_key = self._slot_lock_key(clinic_id, doctor_id, slot)
                    if await self._try_lock_slot(lock_key):
                        if best_candidate is None or slot < best_candidate[0]:
                            best_candidate = (slot, doctor, lock_key)
                        else:
                            await self.release_slot_lock(lock_key)
                        break
                slot += timedelta(minutes=self.slot_duration_minutes)

        if best_candidate is None:
            return None

        slot_at, doctor, lock_key = best_candidate
        logger.info(
            "appointment_slot_locked",
            extra={
                "clinic_id": clinic_id,
                "doctor_id": str(doctor.get("id") or ""),
                "specialty": specialty,
                "lock_key": lock_key,
                "slot": slot_at.isoformat(),
            },
        )
        return ScheduledSlot(
            doctor_id=str(doctor.get("id") or ""),
            doctor_name=str(doctor.get("name") or "Profesional"),
            specialty=str(doctor.get("specialty") or specialty),
            appointment_at=slot_at,
            lock_key=lock_key,
        )
