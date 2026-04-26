from __future__ import annotations

import json
from fnmatch import fnmatch
from datetime import datetime

import pytest

from brain.core.date_resolver import DateResolver
from brain.core.state_manager import StateManager
from brain.interpreters.nlu_engine import NLUEngine
from brain.main import BrainWorker
from brain.services.orchestrator import BrainOrchestrator


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.expiry: dict[str, int] = {}
        self.lock_expiry_ms: dict[str, int] = {}
        self.incoming: list[str] = []
        self.outgoing: list[tuple[str, str]] = []
        self.closed = False

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def setex(self, key: str, ttl: int, value: str) -> None:
        self.store[key] = value
        self.expiry[key] = ttl

    async def delete(self, key: str) -> None:
        self.store.pop(key, None)
        self.expiry.pop(key, None)
        self.lock_expiry_ms.pop(key, None)

    async def set(self, key: str, value: str, nx: bool = False, px: int | None = None):
        if nx and key in self.store:
            return None
        self.store[key] = value
        if px is not None:
            self.lock_expiry_ms[key] = px
        return True

    async def exists(self, key: str) -> int:
        return 1 if key in self.store else 0

    async def keys(self, pattern: str) -> list[str]:
        return [key for key in self.store if fnmatch(key, pattern)]

    async def eval(self, script: str, keys_count: int, key: str, token: str):
        assert keys_count == 1
        if self.store.get(key) == token:
            await self.delete(key)
            return 1
        return 0

    async def incrby(self, key: str, amount: int):
        current = int(self.store.get(key, "0"))
        updated = current + amount
        self.store[key] = str(updated)
        return updated

    async def execute_command(self, command: str, queue_name: str, *args):
        if command == "BRPOP":
            assert queue_name == "whatsapp:incoming"
            if not self.incoming:
                return None
            return queue_name, self.incoming.pop(0)

        if command == "LPUSH":
            payload = args[0]
            self.outgoing.append((queue_name, payload))
            return len(self.outgoing)

        raise AssertionError(f"Comando no soportado en test: {command}")

    async def aclose(self) -> None:
        self.closed = True


class FakeAPIClient:
    def __init__(self) -> None:
        self.created_appointments: list[dict[str, str]] = []
        self.cancelled_appointments: list[str] = []
        self.doctors_by_specialty: dict[str, list[dict[str, str]]] = {}
        self.patient_appointments: list[dict[str, str]] = []

    async def get_or_create_patient_by_phone(self, phone: str) -> dict[str, str]:
        return {"id": "patient-123", "phone": phone}

    async def list_doctors_by_specialty(self, specialty: str) -> list[dict[str, str]]:
        if specialty in self.doctors_by_specialty:
            return self.doctors_by_specialty[specialty]
        return [{"id": "doctor-1", "name": "Dra. Rivera", "specialty": specialty}]

    async def create_appointment(self, **payload):
        self.created_appointments.append(payload)
        return {"id": "appointment-999"}

    async def get_patient_appointments(self, patient_id: str):
        assert patient_id == "patient-123"
        return list(self.patient_appointments)

    async def cancel_appointment(self, appointment_id: str):
        self.cancelled_appointments.append(appointment_id)
        return {"id": appointment_id, "status": "cancelled", "date_time": "2026-04-12T15:30:00"}

    async def close(self) -> None:
        return None


@pytest.mark.asyncio
async def test_state_manager_persists_and_clears_state() -> None:
    redis = FakeRedis()
    state_manager = StateManager(client=redis, ttl_seconds=120)

    await state_manager.set_state("+34123456789", {"step": "awaiting_specialty", "context": {"foo": "bar"}})

    stored = await state_manager.get_state("+34123456789")
    assert stored == {"step": "awaiting_specialty", "context": {"foo": "bar"}}
    assert redis.expiry["chat_state:+34123456789"] == 120

    await state_manager.clear_state("+34123456789")
    assert await state_manager.get_state("+34123456789") == {"step": "idle", "context": {}}


@pytest.mark.asyncio
async def test_state_manager_conversation_lock_acquire_and_release() -> None:
    redis = FakeRedis()
    state_manager = StateManager(client=redis, ttl_seconds=120)

    async with state_manager.conversation_lock("+34123456789") as locked:
        assert locked is True
        assert "lock:chat:+34123456789" in redis.store

    assert "lock:chat:+34123456789" not in redis.store


def test_nlu_extracts_specialty_and_datetime_entities() -> None:
    entities = NLUEngine.extract_basic_entities(
        "Quiero un turno con cardiologia el 12/04/2026 a las 15:30"
    )

    assert entities["specialty"] == "Cardiologia"
    assert entities["appointment_at"] is not None
    assert entities["appointment_at"].isoformat() == "2026-04-12T15:30:00"
    assert entities["ambiguous_date"] is False


@pytest.mark.asyncio
async def test_nlu_classifies_system_reset_with_high_priority() -> None:
    intent = await NLUEngine.classify_intent("Quiero cancelar y empezar de nuevo")
    assert intent == "SYSTEM_RESET"


def test_nlu_marks_weekday_as_ambiguous_without_explicit_date() -> None:
    entities = NLUEngine.extract_basic_entities("El martes me viene bien")

    assert entities["date_hint"] == "martes"
    assert entities["ambiguous_date"] is True
    assert entities["appointment_at"] is None


@pytest.mark.asyncio
async def test_nlu_returns_metabrain_source(monkeypatch: pytest.MonkeyPatch) -> None:
    analysis = await NLUEngine.analyze("Quiero un turno con cardiologia")

    assert analysis["source"] == "METABRAIN"
    assert analysis["intent"] == "book_appointment"
    assert analysis["entities"]["specialty"] == "Cardiologia"


def test_date_resolver_handles_pm_and_relative_dates() -> None:
    resolved = DateResolver.resolve(
        "este martes a las 3 pm",
        reference_datetime=datetime(2026, 4, 1, 9, 0, 0),
    )

    assert resolved["ambiguous_date"] is False
    assert resolved["appointment_at"].isoformat() == "2026-04-07T15:00:00"


@pytest.mark.asyncio
async def test_orchestrator_completes_booking_flow() -> None:
    redis = FakeRedis()
    api_client = FakeAPIClient()
    state_manager = StateManager(client=redis, ttl_seconds=600)
    orchestrator = BrainOrchestrator(state_manager=state_manager, api_client=api_client)
    future_booking_text = "12/04/2099 a las 15:30"

    first_reply = await orchestrator.handle_message({"from": "+34600000001", "text": "Quiero reservar una cita"})
    second_reply = await orchestrator.handle_message({"from": "+34600000001", "text": "cardiologia"})
    final_reply = await orchestrator.handle_message({"from": "+34600000001", "text": future_booking_text})

    assert "especialidad" in first_reply["text"].lower()
    assert "fecha y hora" in second_reply["text"].lower()
    assert "tu cita fue registrada" in final_reply["text"].lower()
    assert api_client.created_appointments[0]["patient_id"] == "patient-123"
    assert api_client.created_appointments[0]["doctor_id"] == "doctor-1"
    assert await state_manager.get_state("+34600000001") == {"step": "idle", "context": {}}


@pytest.mark.asyncio
async def test_orchestrator_requires_doctor_selection_when_multiple_options() -> None:
    redis = FakeRedis()
    api_client = FakeAPIClient()
    api_client.doctors_by_specialty["Cardiologia"] = [
        {"id": "doctor-1", "name": "Dra. Rivera", "specialty": "Cardiologia"},
        {"id": "doctor-2", "name": "Dr. Salas", "specialty": "Cardiologia"},
    ]
    state_manager = StateManager(client=redis, ttl_seconds=600)
    orchestrator = BrainOrchestrator(state_manager=state_manager, api_client=api_client)
    future_booking_text = "12/04/2099 a las 15:30"

    first_reply = await orchestrator.handle_message(
        {"from": "+34600000003", "text": f"Quiero una cita con cardiologia el {future_booking_text}"}
    )
    second_reply = await orchestrator.handle_message({"from": "+34600000003", "text": "2"})

    assert "varios doctores" in first_reply["text"].lower()
    assert "dr. salas" in second_reply["text"].lower()
    assert api_client.created_appointments[0]["doctor_id"] == "doctor-2"


@pytest.mark.asyncio
async def test_orchestrator_cancels_selected_appointment() -> None:
    redis = FakeRedis()
    api_client = FakeAPIClient()
    api_client.patient_appointments = [
        {"id": "appointment-1", "date_time": "2026-04-12T15:30:00"},
        {"id": "appointment-2", "date_time": "2026-04-18T10:00:00"},
    ]
    state_manager = StateManager(client=redis, ttl_seconds=600)
    orchestrator = BrainOrchestrator(state_manager=state_manager, api_client=api_client)

    prompt_reply = await orchestrator.handle_message({"from": "+34600000004", "text": "Quiero anular una cita"})
    final_reply = await orchestrator.handle_message({"from": "+34600000004", "text": "2"})

    assert "responde con el numero" in prompt_reply["text"].lower()
    assert api_client.cancelled_appointments == ["appointment-2"]
    assert "fue cancelada correctamente" in final_reply["text"].lower()


@pytest.mark.asyncio
async def test_orchestrator_system_reset_clears_state() -> None:
    redis = FakeRedis()
    api_client = FakeAPIClient()
    state_manager = StateManager(client=redis, ttl_seconds=600)
    orchestrator = BrainOrchestrator(state_manager=state_manager, api_client=api_client)

    await state_manager.set_state(
        "+34600000005",
        {"step": "awaiting_datetime", "context": {"specialty": "Cardiologia"}},
    )

    reply = await orchestrator.handle_message({"from": "+34600000005", "text": "salir"})

    assert "cancelamos el flujo" in reply["text"].lower()
    assert await state_manager.get_state("+34600000005") == {"step": "idle", "context": {}}
    assert await state_manager.get_metric("system_reset_total") == 1


@pytest.mark.asyncio
async def test_brain_worker_consumes_and_publishes_response() -> None:
    redis = FakeRedis()
    redis.incoming.append(json.dumps({"from": "+34600000002", "text": "Quiero reservar una cita"}))

    class FakeOrchestrator:
        async def handle_message(self, message):
            assert message["from"] == "+34600000002"
            return {"phone": "+34600000002", "text": "Respuesta generada"}

    worker = BrainWorker(
        redis_client=redis,
        orchestrator=FakeOrchestrator(),
        api_client=FakeAPIClient(),
        state_manager=StateManager(client=redis),
    )

    processed = await worker.process_once(timeout=1)

    assert processed is True
    assert len(redis.outgoing) == 1
    queue_name, raw_payload = redis.outgoing[0]
    assert queue_name == "whatsapp:outgoing"
    assert json.loads(raw_payload) == {"phone": "+34600000002", "text": "Respuesta generada"}


@pytest.mark.asyncio
async def test_brain_worker_returns_busy_message_when_phone_lock_is_held() -> None:
    redis = FakeRedis()
    phone = "+34600000006"
    redis.incoming.append(json.dumps({"from": phone, "text": "Quiero reservar una cita"}))
    redis.store[f"lock:chat:{phone}"] = "foreign-worker-token"

    class FakeOrchestrator:
        async def handle_message(self, message):
            raise AssertionError("No debe procesar el mensaje si el lock esta tomado")

    worker = BrainWorker(
        redis_client=redis,
        orchestrator=FakeOrchestrator(),
        api_client=FakeAPIClient(),
        state_manager=StateManager(client=redis),
    )

    processed = await worker.process_once(timeout=1)

    assert processed is True
    assert len(redis.outgoing) == 1
    queue_name, raw_payload = redis.outgoing[0]
    assert queue_name == "whatsapp:outgoing"
    assert json.loads(raw_payload) == {
        "phone": phone,
        "text": "Estoy procesando tu mensaje anterior, un momento por favor...",
    }
    assert await worker.state_manager.get_metric("lock_contention_total") == 1
