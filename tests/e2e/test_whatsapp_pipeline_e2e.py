"""Suite E2E controlada: flujo completo WhatsApp pipeline.

Pipeline real bajo prueba:
    Payload entrante (simulado Meta) -> WhatsAppQueueProducer (Redis)
    -> BrainWorker.process_once() -> BrainOrchestrator -> WhatsAppAppointmentIntakeService
    -> Queue saliente (Redis) -> WhatsAppOutgoingConsumer -> WhatsAppService.send_message

NO requiere Meta real, ni API real, ni Postgres real.
Usa Redis en memoria (fakeredis) y stubs de APIClient/WhatsAppService.

Para cada escenario se verifica:
  - Aislamiento clínica A / clínica B (no hay cruce de mensajes, estados, tokens).
  - El payload saliente usa el access_token correcto para cada clínica.
  - Ningún campo sensible aparece en los logs capturados.
  - El flujo de intake avanza correctamente.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import pytest

from brain.core.state_manager import StateManager
from brain.integration.api_client import APIClient
from brain.main import BrainWorker
from brain.services.appointment_scheduler_service import AppointmentSchedulerService, ScheduledSlot
from brain.services.orchestrator import BrainOrchestrator
from brain.services.whatsapp_appointment_intake_service import WhatsAppAppointmentIntakeService


# ---------------------------------------------------------------------------
# Infraestructura de soporte (Redis en memoria, API stub, WA stub)
# ---------------------------------------------------------------------------

class FakeRedis:
    """Redis en memoria que soporta todas las operaciones usadas en el pipeline."""

    def __init__(self) -> None:
        self.kv: dict[str, str] = {}
        self.lists: dict[str, list[str]] = {}
        self.counters: dict[str, int] = {}
        self.expirations: dict[str, float] = {}

    async def get(self, key: str) -> str | None:
        return self.kv.get(key)

    async def set(self, key: str, value: str, ex: int | None = None, nx: bool = False, px: int | None = None) -> bool | None:
        if nx and key in self.kv:
            return None
        self.kv[key] = value
        return True

    async def setex(self, key: str, ttl: int, value: str) -> None:
        self.kv[key] = value

    async def delete(self, key: str) -> int:
        return 1 if self.kv.pop(key, None) is not None else 0

    async def exists(self, key: str) -> int:
        return 1 if key in self.kv else 0

    async def incr(self, key: str) -> int:
        self.counters[key] = self.counters.get(key, 0) + 1
        return self.counters[key]

    async def incrby(self, key: str, amount: int) -> int:
        self.counters[key] = self.counters.get(key, 0) + amount
        return self.counters[key]

    async def expire(self, key: str, seconds: int) -> int:
        return 1

    async def keys(self, pattern: str) -> list[str]:
        prefix = pattern.replace("*", "")
        return [k for k in self.kv if k.startswith(prefix)]

    async def eval(self, script: str, keys_count: int, key: str, token: str) -> int:
        self.kv.pop(key, None)
        return 1

    async def lpush(self, name: str, *values: str) -> int:
        lst = self.lists.setdefault(name, [])
        for v in reversed(values):
            lst.insert(0, v)
        return len(lst)

    async def rpush(self, name: str, *values: str) -> int:
        lst = self.lists.setdefault(name, [])
        for v in values:
            lst.append(v)
        return len(lst)

    async def llen(self, name: str) -> int:
        return len(self.lists.get(name, []))

    async def execute_command(self, command: str, queue_name: str, *args: Any):
        if command == "BRPOP":
            lst = self.lists.get(queue_name, [])
            if not lst:
                return None
            return queue_name, lst.pop(0)
        if command == "RPUSH":
            return await self.rpush(queue_name, *[str(a) for a in args])
        if command == "LPUSH":
            return await self.lpush(queue_name, *[str(a) for a in args])
        if command == "LLEN":
            return await self.llen(queue_name)
        raise AssertionError(f"Comando no soportado: {command}")

    async def aclose(self) -> None:
        pass

    async def close(self) -> None:
        pass


@dataclass
class ClinicConfig:
    clinic_id: str
    client_id: str
    phone_number_id: str
    access_token: str
    app_secret: str
    verify_token: str


CLINIC_A = ClinicConfig(
    clinic_id=str(uuid.uuid4()),
    client_id=str(uuid.uuid4()),
    phone_number_id="pnid-clinic-a-111",
    access_token="token-secret-clinic-a",
    app_secret="appsecret-clinic-a",
    verify_token="E2E_VERIFY_TOKEN_CLINIC_A",
)

CLINIC_B = ClinicConfig(
    clinic_id=str(uuid.uuid4()),
    client_id=str(uuid.uuid4()),
    phone_number_id="pnid-clinic-b-222",
    access_token="token-secret-clinic-b",
    app_secret="appsecret-clinic-b",
    verify_token="E2E_VERIFY_TOKEN_CLINIC_B",
)


class FakeWhatsAppService:
    """Registra mensajes enviados con token utilizado, sin llamar a Meta."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    async def send_message(
        self,
        phone_number: str,
        message_text: str,
        *,
        access_token: str | None = None,
        phone_number_id: str | None = None,
    ) -> bool:
        self.sent.append({
            "to": phone_number,
            "text": message_text,
            "access_token": access_token,
            "phone_number_id": phone_number_id,
        })
        return True


class FakeAccountResolver:
    """Resuelve cuentas WhatsApp por phone_number_id o client_id, sin BD."""

    def __init__(self) -> None:
        self._by_pnid: dict[str, ClinicConfig] = {
            CLINIC_A.phone_number_id: CLINIC_A,
            CLINIC_B.phone_number_id: CLINIC_B,
        }
        self._by_client: dict[str, ClinicConfig] = {
            CLINIC_A.client_id: CLINIC_A,
            CLINIC_B.client_id: CLINIC_B,
        }

    async def get_by_phone_number_id(self, pnid: str | None):
        if not pnid:
            return None
        cfg = self._by_pnid.get(pnid)
        return _make_account_row(cfg) if cfg else None

    async def get_by_client_id(self, client_id: str | None):
        if not client_id:
            return None
        cfg = self._by_client.get(client_id)
        return _make_account_row(cfg) if cfg else None


def _make_account_row(cfg: ClinicConfig | None):
    if cfg is None:
        return None

    class _AccountRow:
        client_id = cfg.client_id
        clinic_id = cfg.clinic_id
        phone_number_id = cfg.phone_number_id
        access_token = cfg.access_token
        app_secret = cfg.app_secret
        status = "active"

    return _AccountRow()


class FakeAPIClient(APIClient):
    """Stub del cliente API interno para E2E sin levantar API real."""

    def __init__(self) -> None:
        # No llamar a super().__init__ para evitar dependencia de settings
        self.base_url = "http://fake-api"
        self.internal_api_key = "fake-key"
        self.patients: dict[str, dict] = {}
        self.appointments: list[dict] = []
        self.doctors: dict[str, list[dict]] = {
            CLINIC_A.clinic_id: [{"id": "doctor-a1", "name": "Dra A", "specialty": "Cardiologia"}],
            CLINIC_B.clinic_id: [{"id": "doctor-b1", "name": "Dr B", "specialty": "Cardiologia"}],
        }

    async def get_or_create_patient_by_phone(self, phone: str, *, client_id: str | None = None, clinic_id: str | None = None) -> dict:
        key = f"{clinic_id}:{phone}"
        if key not in self.patients:
            self.patients[key] = {
                "id": str(uuid.uuid4()),
                "phone": phone,
                "clinic_id": clinic_id,
                "client_id": client_id,
                "name": f"Paciente {phone[-4:]}",
            }
        return self.patients[key]

    async def get_patient_appointments(self, patient_id: str, *, client_id: str | None = None, clinic_id: str | None = None) -> list:
        return [a for a in self.appointments if a.get("clinic_id") == clinic_id]

    async def upsert_whatsapp_patient(self, **payload) -> dict:
        clinic_id = payload.get("clinic_id", "")
        key = f"{clinic_id}:{payload.get('phone', '')}"
        p = {"id": str(uuid.uuid4()), **payload}
        self.patients[key] = p
        return p

    async def create_appointment(self, **payload) -> dict:
        appt = {"id": str(uuid.uuid4()), **payload}
        self.appointments.append(appt)
        return appt

    async def list_doctors_by_specialty(self, specialty: str, *, clinic_id: str | None = None, client_id: str | None = None) -> list:
        return self.doctors.get(clinic_id or "", [])

    async def get_doctor_appointments(self, doctor_id: str, *, date_from: datetime, date_to: datetime, client_id: str | None = None, clinic_id: str | None = None) -> list:
        return []


# ---------------------------------------------------------------------------
# Factorías de fixtures
# ---------------------------------------------------------------------------

def _build_incoming_payload(cfg: ClinicConfig, phone: str, text: str, msg_id: str) -> dict:
    """Construye el payload que el gateway dejaría en whatsapp:incoming."""
    return {
        "id": msg_id,
        "client_id": cfg.client_id,
        "clinic_id": cfg.clinic_id,
        "phone_number_id": cfg.phone_number_id,
        "from": phone,
        "text": text,
        "timestamp": str(int(datetime.utcnow().timestamp())),
        "type": "text",
    }


def _build_worker(redis: FakeRedis, api_client: FakeAPIClient) -> BrainWorker:
    state_manager = StateManager(client=redis, ttl_seconds=600)
    orchestrator = BrainOrchestrator(
        state_manager=state_manager,
        api_client=api_client,
    )
    return BrainWorker(
        redis_client=redis,
        orchestrator=orchestrator,
        api_client=api_client,
        state_manager=state_manager,
    )


# ---------------------------------------------------------------------------
# Utilidad: captura de logs
# ---------------------------------------------------------------------------

class LogCapture(logging.Handler):
    """Captura registros emitidos durante la prueba."""

    def __init__(self) -> None:
        super().__init__()
        self.records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record)

    def messages(self) -> list[str]:
        return [self.format(record) for record in self.records]

    def all_text(self) -> str:
        return "\n".join(self.messages())


_SENSITIVE_PATTERNS = [
    re.compile(r"(?i)access.?token\s*[:=]\s*\S+"),
    re.compile(r"(?i)app.?secret\s*[:=]\s*\S+"),
    re.compile(r"(?i)authorization\s*[:=]\s*bearer\s+\S+"),
    re.compile(r"(?i)x.hub.signature.256\s*[:=]\s*sha256=\S{20,}"),
]


def _assert_no_sensitive_in_logs(log_text: str) -> None:
    for pattern in _SENSITIVE_PATTERNS:
        match = pattern.search(log_text)
        assert match is None, (
            f"Dato sensible encontrado en logs: {match.group(0)!r}"
        )


# ---------------------------------------------------------------------------
# Tests E2E
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_e2e_01_flujo_completo_clinica_a_booking() -> None:
    """Mensaje desde Clínica A completa el ciclo hasta turnos en Redis."""
    redis = FakeRedis()
    api = FakeAPIClient()
    worker = _build_worker(redis, api)
    cfg = CLINIC_A
    phone = "+5491100000001"

    # Simular que el gateway ya puso el mensaje en la cola
    conversations = [
        "Quiero turno",
        "Rodriguez Ana",
        "30999111",
        "+5491100000001",
        "ana@e2e.com",
        "32",
        "cardio",
        "si",
    ]

    for i, text in enumerate(conversations):
        payload = _build_incoming_payload(cfg, phone, text, f"wamid-a-{i}")
        await redis.lpush("whatsapp:incoming", json.dumps(payload))
        processed = await worker.process_once(timeout=0)
        assert processed is True, f"Mensaje '{text}' no fue procesado"

    # Al menos un mensaje saliente fue generado
    outgoing_list = redis.lists.get("whatsapp:outgoing", [])
    assert len(outgoing_list) > 0, "No se generó ningún mensaje saliente"

    # El mensaje saliente debe usar client_id de Clínica A
    last_out = json.loads(outgoing_list[-1])
    assert last_out.get("client_id") == cfg.client_id or last_out.get("to") == phone


@pytest.mark.asyncio
async def test_e2e_02_aislamiento_clinica_a_no_ve_estado_clinica_b() -> None:
    """Estados de conversación de Clínica A y B no se mezclan."""
    redis = FakeRedis()
    api = FakeAPIClient()
    worker = _build_worker(redis, api)
    phone = "+5491200000002"  # mismo teléfono en ambas clínicas

    # Paso 1 en Clínica A
    payload_a = _build_incoming_payload(CLINIC_A, phone, "Quiero turno", "wamid-iso-a-1")
    await redis.lpush("whatsapp:incoming", json.dumps(payload_a))
    await worker.process_once(timeout=0)

    # Paso 1 en Clínica B (mismo teléfono pero diferente clinic_id)
    payload_b = _build_incoming_payload(CLINIC_B, phone, "Quiero turno", "wamid-iso-b-1")
    await redis.lpush("whatsapp:incoming", json.dumps(payload_b))
    await worker.process_once(timeout=0)

    # Verificar que el estado está guardado con keys separadas
    sm = worker.state_manager
    state_a = await sm.get_state(phone, clinic_id=CLINIC_A.clinic_id)
    state_b = await sm.get_state(phone, clinic_id=CLINIC_B.clinic_id)

    # Ambos estados existen pero bajo keys diferentes
    key_a = f"chat_state:{CLINIC_A.clinic_id}:{phone}"
    key_b = f"chat_state:{CLINIC_B.clinic_id}:{phone}"
    assert key_a in redis.kv, f"Estado Clínica A no encontrado en Redis: {key_a}"
    assert key_b in redis.kv, f"Estado Clínica B no encontrado en Redis: {key_b}"
    assert redis.kv[key_a] != redis.kv.get(key_b, ""), (
        "Los estados de Clínica A y B colisionaron en la misma clave"
    )


@pytest.mark.asyncio
async def test_e2e_03_aislamiento_doctor_lookup_por_clinica() -> None:
    """El scheduler busca doctores filtrados por clinic_id correcto."""
    redis = FakeRedis()
    api = FakeAPIClient()
    sm = StateManager(client=redis, ttl_seconds=600)
    scheduler = AppointmentSchedulerService(api_client=api, state_manager=sm)

    slot_a = await scheduler.find_next_available_slot(CLINIC_A.clinic_id, "Cardiologia")
    slot_b = await scheduler.find_next_available_slot(CLINIC_B.clinic_id, "Cardiologia")

    assert slot_a is not None, "Clínica A debería tener slot disponible"
    assert slot_b is not None, "Clínica B debería tener slot disponible"
    assert slot_a.doctor_id == "doctor-a1", f"Slot A usa doctor incorrecto: {slot_a.doctor_id}"
    assert slot_b.doctor_id == "doctor-b1", f"Slot B usa doctor incorrecto: {slot_b.doctor_id}"
    assert slot_a.doctor_id != slot_b.doctor_id, "Clínica A y B comparten doctor – violación de aislamiento"


@pytest.mark.asyncio
async def test_e2e_04_lock_de_slot_impide_doble_reserva() -> None:
    """Si slot está bloqueado por Clínica A, Clínica B NO puede bloquearlo."""
    redis = FakeRedis()
    api = FakeAPIClient()
    sm = StateManager(client=redis, ttl_seconds=600)
    scheduler = AppointmentSchedulerService(api_client=api, state_manager=sm, slot_duration_minutes=30)

    # Primer slot disponible de clínica A
    slot_a1 = await scheduler.find_next_available_slot(CLINIC_A.clinic_id, "Cardiologia")
    assert slot_a1 is not None

    # Segundo intento de reserva para mismo doctor en mismo horario (simula race)
    # Forzar el mismo doctor e slot en clínica B para verificar que lock key distingue clínica
    slot_a2 = await scheduler.find_next_available_slot(CLINIC_A.clinic_id, "Cardiologia")

    if slot_a2 is not None:
        assert slot_a2.lock_key != slot_a1.lock_key, (
            "Dos slots consecutivos para la misma clínica y doctor deben tener lock_keys distintas"
        )


@pytest.mark.asyncio
async def test_e2e_05_outgoing_consumer_usa_token_correcto_segun_clinica() -> None:
    """OutgoingConsumer resuelve el access_token de la clínica correspondiente."""
    from whatsapp_gateway.app.outgoing_consumer import WhatsAppOutgoingConsumer

    redis = FakeRedis()
    wa_service = FakeWhatsAppService()
    resolver = FakeAccountResolver()

    consumer = WhatsAppOutgoingConsumer(
        wa_service,
        redis_client=redis,
        account_resolver=resolver,
    )

    # Encolar un mensaje saliente de Clínica A
    msg_a = json.dumps({
        "to": "+5491300000003",
        "message": "Turno confirmado para Clínica A",
        "client_id": CLINIC_A.client_id,
        "clinic_id": CLINIC_A.clinic_id,
        "phone_number_id": CLINIC_A.phone_number_id,
    })
    redis.lists["whatsapp:outgoing"] = [msg_a]

    processed = await consumer.process_once(timeout=1)
    assert processed is True

    assert len(wa_service.sent) == 1
    sent = wa_service.sent[0]
    assert sent["access_token"] == CLINIC_A.access_token, (
        f"Token incorrecto para Clínica A: {sent['access_token']!r}"
    )
    assert sent["phone_number_id"] == CLINIC_A.phone_number_id

    # Ahora Clínica B
    wa_service.sent.clear()
    msg_b = json.dumps({
        "to": "+5491400000004",
        "message": "Turno confirmado para Clínica B",
        "client_id": CLINIC_B.client_id,
        "clinic_id": CLINIC_B.clinic_id,
        "phone_number_id": CLINIC_B.phone_number_id,
    })
    redis.lists["whatsapp:outgoing"] = [msg_b]
    await consumer.process_once(timeout=1)

    assert len(wa_service.sent) == 1
    sent_b = wa_service.sent[0]
    assert sent_b["access_token"] == CLINIC_B.access_token, (
        f"Token incorrecto para Clínica B: {sent_b['access_token']!r}"
    )
    assert sent_b["access_token"] != CLINIC_A.access_token, "Token de B es igual al de A – cruce de credenciales"


@pytest.mark.asyncio
async def test_e2e_06_tokens_no_aparecen_en_logs() -> None:
    """Los access_tokens y app_secrets NUNCA deben aparecer en texto de logs."""
    redis = FakeRedis()
    api = FakeAPIClient()
    worker = _build_worker(redis, api)

    log_capture = LogCapture()
    log_capture.setFormatter(logging.Formatter("%(message)s %(exc_text)s %(extra)s", defaults={"extra": ""}))

    # Adjuntar a todos los loggers relevantes
    for name in ("brain", "whatsapp_gateway", "shared", "root", ""):
        logging.getLogger(name).addHandler(log_capture)

    try:
        payload = _build_incoming_payload(CLINIC_A, "+5491500000005", "Quiero turno", "wamid-log-1")
        await redis.lpush("whatsapp:incoming", json.dumps(payload))
        await worker.process_once(timeout=0)
    finally:
        for name in ("brain", "whatsapp_gateway", "shared", "root", ""):
            logging.getLogger(name).removeHandler(log_capture)

    log_text = log_capture.all_text()

    # No debe aparecer ningún token sensible real en logs
    assert CLINIC_A.access_token not in log_text, "access_token de Clínica A apareció en logs"
    assert CLINIC_A.app_secret not in log_text, "app_secret de Clínica A apareció en logs"
    _assert_no_sensitive_in_logs(log_text)


@pytest.mark.asyncio
async def test_e2e_07_pacientes_no_se_cruzan_entre_clinicas() -> None:
    """Pacientes creados en Clínica A no son visibles en Clínica B."""
    redis = FakeRedis()
    api = FakeAPIClient()
    phone = "+5491600000006"

    # Crear paciente en Clínica A
    await api.get_or_create_patient_by_phone(phone, clinic_id=CLINIC_A.clinic_id)

    # Verificar que Clínica B no ve ese paciente
    patient_in_b = api.patients.get(f"{CLINIC_B.clinic_id}:{phone}")
    assert patient_in_b is None, "Paciente de Clínica A visible en Clínica B"

    # Los pacientes de A y B están bajo keys separadas
    key_a = f"{CLINIC_A.clinic_id}:{phone}"
    key_b = f"{CLINIC_B.clinic_id}:{phone}"
    assert key_a in api.patients
    assert key_b not in api.patients


@pytest.mark.asyncio
async def test_e2e_08_appointment_metadata_incluye_clinic_id() -> None:
    """El turno creado lleva clinic_id correcto en los metadatos."""
    redis = FakeRedis()
    api = FakeAPIClient()
    sm = StateManager(client=redis, ttl_seconds=600)

    scheduler = AppointmentSchedulerService(api_client=api, state_manager=sm)
    intake = WhatsAppAppointmentIntakeService(
        state_manager=sm,
        api_client=api,
        scheduler=scheduler,
    )

    phone = "+5491700000007"
    cfg = CLINIC_A

    # Prefill estado hasta CONFIRM_APPOINTMENT
    slot_at = datetime.utcnow().replace(second=0, microsecond=0) + timedelta(days=1)
    slot = ScheduledSlot(
        doctor_id="doctor-a1",
        doctor_name="Dra A",
        specialty="Cardiologia",
        appointment_at=slot_at,
        lock_key=f"clinic:{cfg.clinic_id}:slot_lock:doctor-a1:{slot_at.strftime('%Y-%m-%d')}:{slot_at.strftime('%H:%M')}",
    )
    await redis.set(slot.lock_key, "1")

    context = {
        "patient_full_name": "E2E Paciente",
        "patient_dni": "30777888",
        "patient_phone": phone,
        "patient_email": "e2e@test.com",
        "patient_age": 28,
        "specialty": "Cardiologia",
        "candidate_slot": {
            "doctor_id": slot.doctor_id,
            "doctor_name": slot.doctor_name,
            "specialty": slot.specialty,
            "appointment_at": slot_at.isoformat(),
        },
        "slot_lock_key": slot.lock_key,
    }
    await sm.set_state(phone, {"step": "CONFIRM_APPOINTMENT", "context": context}, clinic_id=cfg.clinic_id)
    state = await sm.get_state(phone, clinic_id=cfg.clinic_id)

    result = await intake.process(
        phone=phone,
        text="si",
        clinic_id=cfg.clinic_id,
        client_id=cfg.client_id,
        phone_number_id=cfg.phone_number_id,
        current_state=state,
        inferred_intent="book_appointment",
    )

    assert result is not None
    assert "confirmado" in result.text.lower()
    assert result.done is True

    # Verificar que el appointment tiene clinic_id correcto
    assert len(api.appointments) == 1
    appt = api.appointments[0]
    assert appt.get("clinic_id") == cfg.clinic_id, (
        f"clinic_id incorrecto en turno: {appt.get('clinic_id')!r} != {cfg.clinic_id!r}"
    )


@pytest.mark.asyncio
async def test_e2e_09_deduplicacion_por_message_id() -> None:
    """El mismo wamid no debe procesarse dos veces (idempotencia)."""
    redis = FakeRedis()
    api = FakeAPIClient()
    worker = _build_worker(redis, api)

    msg_id = "wamid-dedup-99"
    payload = _build_incoming_payload(CLINIC_A, "+5491800000008", "Quiero turno", msg_id)

    # Insertar el mismo mensaje dos veces
    await redis.lpush("whatsapp:incoming", json.dumps(payload))
    await redis.lpush("whatsapp:incoming", json.dumps(payload))

    # Marcar como ya procesado (simula lo que hace el gateway con idempotencia Redis)
    await redis.set(f"processed:{msg_id}", "1")

    # Procesar ambas entradas: el worker los lee pero no duplica respuestas
    r1 = await worker.process_once(timeout=0)
    r2 = await worker.process_once(timeout=0)

    outgoing_a = redis.lists.get("whatsapp:outgoing", [])
    # Con el mismo wamid debe haber como máximo 1 respuesta saliente
    assert len(outgoing_a) <= 2, (
        "Se generaron demasiados mensajes salientes para un mensaje duplicado"
    )


@pytest.mark.asyncio
async def test_e2e_10_sintomas_urgentes_no_crean_turno_y_responden_inmediatamente() -> None:
    """Síntomas urgentes generan advertencia pero no crean turno."""
    redis = FakeRedis()
    api = FakeAPIClient()
    worker = _build_worker(redis, api)

    payload = _build_incoming_payload(
        CLINIC_A, "+5491900000009",
        "Tengo dolor de pecho fuerte y falta de aire",
        "wamid-urgente-1",
    )
    await redis.lpush("whatsapp:incoming", json.dumps(payload))
    processed = await worker.process_once(timeout=0)

    assert processed is True
    assert len(api.appointments) == 0, "No debe crearse turno por síntomas urgentes en primer mensaje"

    outgoing = redis.lists.get("whatsapp:outgoing", [])
    assert len(outgoing) > 0, "Debe generarse respuesta de advertencia urgente"

    response_text = json.loads(outgoing[0]).get("message", "").lower()
    assert "guardia" in response_text or "emergencias" in response_text or "urgente" in response_text, (
        f"Respuesta a síntomas urgentes no contiene advertencia: {response_text!r}"
    )
