from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

import pytest

from brain.core.state_manager import StateManager
from brain.services.appointment_scheduler_service import AppointmentSchedulerService, ScheduledSlot
from brain.services.whatsapp_appointment_intake_service import WhatsAppAppointmentIntakeService


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key: str):
        return self.store.get(key)

    async def setex(self, key: str, ttl: int, value: str):
        self.store[key] = value

    async def delete(self, key: str):
        self.store.pop(key, None)

    async def set(self, key: str, value: str, ex: int | None = None, nx: bool = False, px: int | None = None):
        _ = ex, px
        if nx and key in self.store:
            return None
        self.store[key] = value
        return True

    async def exists(self, key: str):
        return 1 if key in self.store else 0

    async def incrby(self, key: str, amount: int):
        current = int(self.store.get(key, "0"))
        current += amount
        self.store[key] = str(current)
        return current

    async def keys(self, pattern: str):
        prefix = pattern.replace("*", "")
        return [k for k in self.store if k.startswith(prefix)]

    async def eval(self, script: str, keys_count: int, key: str, token: str):
        _ = script, keys_count, token
        self.store.pop(key, None)
        return 1


@dataclass
class FakeScheduler:
    slot: ScheduledSlot | None

    async def find_next_available_slot(self, clinic_id: str, specialty: str, *, client_id: str | None = None):
        _ = clinic_id, specialty, client_id
        return self.slot

    async def release_slot_lock(self, lock_key: str):
        _ = lock_key


class FakeAPIClient:
    def __init__(self) -> None:
        self.patients: list[dict] = []
        self.appointments: list[dict] = []
        self.doctors_by_specialty: dict[tuple[str | None, str], list[dict]] = {}
        self.doctor_appointments: dict[tuple[str | None, str], list[dict]] = {}

    async def upsert_whatsapp_patient(self, **payload):
        self.patients.append(payload)
        return {"id": "patient-1", **payload}

    async def create_appointment(self, **payload):
        self.appointments.append(payload)
        return {"id": f"appointment-{len(self.appointments)}", **payload}

    async def list_doctors_by_specialty(self, specialty: str, *, client_id: str | None = None, clinic_id: str | None = None):
        return self.doctors_by_specialty.get((clinic_id, specialty), [])

    async def get_doctor_appointments(
        self,
        doctor_id: str,
        *,
        date_from: datetime,
        date_to: datetime,
        client_id: str | None = None,
        clinic_id: str | None = None,
    ):
        _ = date_from, date_to, client_id
        return self.doctor_appointments.get((clinic_id, doctor_id), [])


@pytest.fixture
def state_manager() -> StateManager:
    return StateManager(client=FakeRedis(), ttl_seconds=600)


@pytest.fixture
def slot() -> ScheduledSlot:
    at = datetime.utcnow().replace(second=0, microsecond=0) + timedelta(days=1)
    return ScheduledSlot(
        doctor_id="doctor-1",
        doctor_name="Dra. Test",
        specialty="Cardiologia",
        appointment_at=at,
        lock_key="clinic:clinic-a:slot_lock:doctor-1:2099-01-01:10:00",
    )


@pytest.mark.asyncio
async def test_1_paciente_nuevo_completa_datos(state_manager: StateManager, slot: ScheduledSlot):
    api = FakeAPIClient()
    service = WhatsAppAppointmentIntakeService(
        state_manager=state_manager,
        api_client=api,
        scheduler=FakeScheduler(slot=slot),
    )

    phone = "+5491111111111"
    clinic = "clinic-a"
    state = await state_manager.get_state(phone, clinic_id=clinic)

    for msg in ["Quiero un turno", "Perez Juan", "30111222", "+5491111111111", "juan@test.com", "35", "cardio", "OSDE", "si"]:
        result = await service.process(
            phone=phone,
            text=msg,
            clinic_id=clinic,
            client_id="client-a",
            phone_number_id="pnid-a",
            current_state=state,
            inferred_intent="book_appointment",
        )
        assert result is not None
        state = await state_manager.get_state(phone, clinic_id=clinic)

    assert len(api.patients) == 1
    assert len(api.appointments) == 1
    assert api.patients[0].get("social_security") == "OSDE"
    assert api.appointments[0].get("social_security") == "OSDE"


@pytest.mark.asyncio
async def test_2_datos_desordenados(state_manager: StateManager, slot: ScheduledSlot):
    api = FakeAPIClient()
    service = WhatsAppAppointmentIntakeService(
        state_manager=state_manager,
        api_client=api,
        scheduler=FakeScheduler(slot=slot),
    )
    phone = "+5491222222222"
    clinic = "clinic-a"

    state = await state_manager.get_state(phone, clinic_id=clinic)
    await service.process(
        phone=phone,
        text="Necesito turno, mi dni 30111222 y mail maria@test.com, tengo 44 y quiero cardio",
        clinic_id=clinic,
        client_id="client-a",
        phone_number_id="pnid-a",
        current_state=state,
        inferred_intent="book_appointment",
    )
    state = await state_manager.get_state(phone, clinic_id=clinic)
    assert state["step"] in {"ASK_FULL_NAME", "ASK_PHONE"}


@pytest.mark.asyncio
async def test_3_falta_dni_pide_solo_dni(state_manager: StateManager, slot: ScheduledSlot):
    api = FakeAPIClient()
    service = WhatsAppAppointmentIntakeService(state_manager=state_manager, api_client=api, scheduler=FakeScheduler(slot=slot))
    phone = "+5491333333333"
    clinic = "clinic-a"

    await state_manager.set_state(phone, {"step": "ASK_DNI", "context": {"patient_full_name": "Ana Diaz"}}, clinic_id=clinic)
    state = await state_manager.get_state(phone, clinic_id=clinic)
    result = await service.process(
        phone=phone,
        text="",
        clinic_id=clinic,
        client_id="client-a",
        phone_number_id="pnid-a",
        current_state=state,
        inferred_intent="book_appointment",
    )
    assert result is not None
    assert "DNI" in result.text


@pytest.mark.asyncio
async def test_4_dni_invalido(state_manager: StateManager, slot: ScheduledSlot):
    api = FakeAPIClient()
    service = WhatsAppAppointmentIntakeService(state_manager=state_manager, api_client=api, scheduler=FakeScheduler(slot=slot))
    phone = "+5491444444444"
    clinic = "clinic-a"
    await state_manager.set_state(phone, {"step": "ASK_DNI", "context": {"patient_full_name": "Ana Diaz"}}, clinic_id=clinic)
    state = await state_manager.get_state(phone, clinic_id=clinic)

    result = await service.process(
        phone=phone,
        text="12ab",
        clinic_id=clinic,
        client_id="client-a",
        phone_number_id="pnid-a",
        current_state=state,
        inferred_intent="book_appointment",
    )
    assert result is not None
    assert "7 a 9" in result.text


@pytest.mark.asyncio
async def test_5_email_invalido(state_manager: StateManager, slot: ScheduledSlot):
    api = FakeAPIClient()
    service = WhatsAppAppointmentIntakeService(state_manager=state_manager, api_client=api, scheduler=FakeScheduler(slot=slot))
    phone = "+5491555555555"
    clinic = "clinic-a"
    await state_manager.set_state(
        phone,
        {"step": "ASK_EMAIL", "context": {"patient_full_name": "Ana Diaz", "patient_dni": "30111222", "patient_phone": phone}},
        clinic_id=clinic,
    )
    state = await state_manager.get_state(phone, clinic_id=clinic)

    result = await service.process(
        phone=phone,
        text="email-invalido",
        clinic_id=clinic,
        client_id="client-a",
        phone_number_id="pnid-a",
        current_state=state,
        inferred_intent="book_appointment",
    )
    assert result is not None
    assert "email" in result.text.lower()


@pytest.mark.asyncio
async def test_6_especialidad_inexistente(state_manager: StateManager):
    api = FakeAPIClient()
    service = WhatsAppAppointmentIntakeService(state_manager=state_manager, api_client=api, scheduler=FakeScheduler(slot=None))
    phone = "+5491666666666"
    clinic = "clinic-a"
    await state_manager.set_state(phone, {"step": "ASK_SPECIALTY", "context": {}}, clinic_id=clinic)
    state = await state_manager.get_state(phone, clinic_id=clinic)

    result = await service.process(
        phone=phone,
        text="oncologia nuclear avanzada",
        clinic_id=clinic,
        client_id="client-a",
        phone_number_id="pnid-a",
        current_state=state,
        inferred_intent="book_appointment",
    )
    assert result is not None
    assert "No reconocí" in result.text


@pytest.mark.asyncio
async def test_7_turno_disponible_confirmado(state_manager: StateManager, slot: ScheduledSlot):
    api = FakeAPIClient()
    service = WhatsAppAppointmentIntakeService(state_manager=state_manager, api_client=api, scheduler=FakeScheduler(slot=slot))
    phone = "+5491777777777"
    clinic = "clinic-a"
    context = {
        "patient_full_name": "Ana Diaz",
        "patient_dni": "30111222",
        "patient_phone": phone,
        "patient_email": "ana@test.com",
        "patient_age": 30,
        "specialty": "Cardiologia",
        "social_security": "PAMI",
        "candidate_slot": {
            "doctor_id": slot.doctor_id,
            "doctor_name": slot.doctor_name,
            "specialty": slot.specialty,
            "appointment_at": slot.appointment_at.isoformat(),
        },
        "slot_lock_key": slot.lock_key,
    }
    await state_manager.set_state(phone, {"step": "CONFIRM_APPOINTMENT", "context": context}, clinic_id=clinic)
    state = await state_manager.get_state(phone, clinic_id=clinic)

    result = await service.process(
        phone=phone,
        text="si",
        clinic_id=clinic,
        client_id="client-a",
        phone_number_id="pnid-a",
        current_state=state,
        inferred_intent="book_appointment",
    )
    assert result is not None
    assert "Turno confirmado" in result.text
    assert "PAMI" in result.text
    assert "obra social" in result.text.lower()


@pytest.mark.asyncio
async def test_8_slot_ocupado_por_otro_paciente(state_manager: StateManager):
    api = FakeAPIClient()
    now = datetime.utcnow().replace(second=0, microsecond=0) + timedelta(days=1)
    api.doctors_by_specialty[("clinic-a", "Cardiologia")] = [{"id": "doctor-1", "name": "Dra", "specialty": "Cardiologia"}]
    scheduler = AppointmentSchedulerService(api_client=api, state_manager=state_manager)

    key = f"clinic:clinic-a:slot_lock:doctor-1:{now.strftime('%Y-%m-%d')}:{now.strftime('%H:%M')}"
    await state_manager.redis_client.set(key, "1", nx=True)
    locked = await scheduler.find_next_available_slot("clinic-a", "Cardiologia", client_id="client-a")
    assert locked is not None
    assert locked.lock_key != key


@pytest.mark.asyncio
async def test_9_clinica_a_no_ve_agenda_b(state_manager: StateManager):
    api = FakeAPIClient()
    api.doctors_by_specialty[("clinic-a", "Cardiologia")] = [{"id": "doctor-a", "name": "A", "specialty": "Cardiologia"}]
    api.doctors_by_specialty[("clinic-b", "Cardiologia")] = [{"id": "doctor-b", "name": "B", "specialty": "Cardiologia"}]

    scheduler = AppointmentSchedulerService(api_client=api, state_manager=state_manager)
    slot_a = await scheduler.find_next_available_slot("clinic-a", "Cardiologia", client_id="client-a")
    slot_b = await scheduler.find_next_available_slot("clinic-b", "Cardiologia", client_id="client-b")

    assert slot_a is not None and slot_b is not None
    assert slot_a.doctor_id == "doctor-a"
    assert slot_b.doctor_id == "doctor-b"


@pytest.mark.asyncio
async def test_10_sintomas_urgentes_activan_advertencia(state_manager: StateManager, slot: ScheduledSlot):
    api = FakeAPIClient()
    service = WhatsAppAppointmentIntakeService(state_manager=state_manager, api_client=api, scheduler=FakeScheduler(slot=slot))
    phone = "+5491888888888"
    clinic = "clinic-a"

    result = await service.process(
        phone=phone,
        text="Tengo dolor de pecho y falta de aire",
        clinic_id=clinic,
        client_id="client-a",
        phone_number_id="pnid-a",
        current_state={"step": "ASK_FULL_NAME", "context": {}},
        inferred_intent="book_appointment",
    )
    assert result is not None
    assert "guardia" in result.text.lower() or "emergencias" in result.text.lower()
