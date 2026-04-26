"""Google Calendar integration service for appointments.

Supports:
- Service Account authentication
- OAuth2 Installed App authentication
- Idempotent create/update/delete operations
"""

from __future__ import annotations

import base64
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional, cast
from uuid import UUID
import uuid
import asyncio
from threading import Lock

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.core.config import settings
from api.app.models import Appointment, Doctor, Patient, GoogleCalendarChannel
from shared.utils import log_structured, setup_logger
from shared.utils.resilience import AsyncRateLimiter, CircuitBreakerConfig, CircuitBreakerRegistry, retry_async

try:
    from google.oauth2 import service_account  # type: ignore
    from google.oauth2.credentials import Credentials  # type: ignore
    from google.auth.transport.requests import Request  # type: ignore
    from google_auth_oauthlib.flow import InstalledAppFlow  # type: ignore
    from googleapiclient.discovery import build  # type: ignore
    from googleapiclient.errors import HttpError  # type: ignore
except Exception:  # pragma: no cover - optional dependency at runtime
    service_account = None  # type: ignore
    Credentials = None  # type: ignore
    Request = None  # type: ignore
    InstalledAppFlow = None  # type: ignore
    build = None  # type: ignore
    HttpError = Exception  # type: ignore


logger = setup_logger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

GOOGLE_RESILIENCE_PROFILES: dict[str, dict[str, float | int]] = {
    "dev": {
        "rate_limit_rps": 3,
        "retry_attempts": 3,
        "retry_base_delay_seconds": 1.0,
        "retry_max_delay_seconds": 8.0,
        "retry_jitter_seconds": 0.15,
        "cb_failure_threshold": 7,
        "cb_reset_timeout_seconds": 30.0,
        "cb_half_open_max_calls": 1,
    },
    "staging": {
        "rate_limit_rps": 5,
        "retry_attempts": 4,
        "retry_base_delay_seconds": 1.0,
        "retry_max_delay_seconds": 8.0,
        "retry_jitter_seconds": 0.2,
        "cb_failure_threshold": 5,
        "cb_reset_timeout_seconds": 45.0,
        "cb_half_open_max_calls": 1,
    },
    "prod": {
        "rate_limit_rps": 8,
        "retry_attempts": 4,
        "retry_base_delay_seconds": 1.0,
        "retry_max_delay_seconds": 8.0,
        "retry_jitter_seconds": 0.25,
        "cb_failure_threshold": 5,
        "cb_reset_timeout_seconds": 60.0,
        "cb_half_open_max_calls": 1,
    },
}


def _active_google_resilience_profile() -> str:
    profile = (settings.google_calendar_resilience_profile or "prod").strip().lower()
    if profile not in GOOGLE_RESILIENCE_PROFILES:
        return "prod"
    return profile


def _effective_google_resilience_config() -> dict[str, float | int | str]:
    profile_name = _active_google_resilience_profile()
    profile = GOOGLE_RESILIENCE_PROFILES[profile_name]
    use_profile_defaults = bool(settings.google_calendar_resilience_use_profile_defaults)

    if use_profile_defaults:
        return {
            "profile": profile_name,
            "rate_limit_rps": int(profile["rate_limit_rps"]),
            "retry_attempts": int(profile["retry_attempts"]),
            "retry_base_delay_seconds": float(profile["retry_base_delay_seconds"]),
            "retry_max_delay_seconds": float(profile["retry_max_delay_seconds"]),
            "retry_jitter_seconds": float(profile["retry_jitter_seconds"]),
            "cb_failure_threshold": int(profile["cb_failure_threshold"]),
            "cb_reset_timeout_seconds": float(profile["cb_reset_timeout_seconds"]),
            "cb_half_open_max_calls": int(profile["cb_half_open_max_calls"]),
            "source": "profile_defaults",
        }

    return {
        "profile": profile_name,
        "rate_limit_rps": max(1, int(settings.google_calendar_rate_limit_rps or profile["rate_limit_rps"])),
        "retry_attempts": max(0, int(settings.google_calendar_retry_attempts or profile["retry_attempts"])),
        "retry_base_delay_seconds": max(
            0.1,
            float(settings.google_calendar_retry_base_delay_seconds or profile["retry_base_delay_seconds"]),
        ),
        "retry_max_delay_seconds": max(
            0.1,
            float(settings.google_calendar_retry_max_delay_seconds or profile["retry_max_delay_seconds"]),
        ),
        "retry_jitter_seconds": max(
            0.0,
            float(settings.google_calendar_retry_jitter_seconds or profile["retry_jitter_seconds"]),
        ),
        "cb_failure_threshold": max(
            1,
            int(settings.google_calendar_cb_failure_threshold or profile["cb_failure_threshold"]),
        ),
        "cb_reset_timeout_seconds": max(
            1.0,
            float(settings.google_calendar_cb_reset_timeout_seconds or profile["cb_reset_timeout_seconds"]),
        ),
        "cb_half_open_max_calls": max(
            1,
            int(settings.google_calendar_cb_half_open_max_calls or profile["cb_half_open_max_calls"]),
        ),
        "source": "env_overrides",
    }


class _GoogleResilienceMetrics:
    def __init__(self) -> None:
        self._lock = Lock()
        self._retry_total = 0
        self._requests_total = 0
        self._last_retry_delay_seconds = 0.0

    def inc_retry(self, delay_seconds: float) -> None:
        with self._lock:
            self._retry_total += 1
            self._last_retry_delay_seconds = float(delay_seconds)

    def inc_request(self) -> None:
        with self._lock:
            self._requests_total += 1

    def snapshot(self) -> dict[str, float | int]:
        with self._lock:
            return {
                "retries_total": self._retry_total,
                "requests_total": self._requests_total,
                "last_retry_delay_seconds": round(self._last_retry_delay_seconds, 3),
            }


_GOOGLE_RESILIENCE_METRICS = _GoogleResilienceMetrics()
_GOOGLE_EFFECTIVE_CONFIG = _effective_google_resilience_config()

_GOOGLE_BREAKER = CircuitBreakerRegistry.get(
    "provider.google.calendar",
    CircuitBreakerConfig(
        failure_threshold=int(_GOOGLE_EFFECTIVE_CONFIG["cb_failure_threshold"]),
        reset_timeout_seconds=float(_GOOGLE_EFFECTIVE_CONFIG["cb_reset_timeout_seconds"]),
        half_open_max_calls=int(_GOOGLE_EFFECTIVE_CONFIG["cb_half_open_max_calls"]),
    ),
)
_GOOGLE_RATE_LIMITER = AsyncRateLimiter(
    max_calls=int(_GOOGLE_EFFECTIVE_CONFIG["rate_limit_rps"]),
    period_seconds=1.0,
)


async def get_google_calendar_resilience_snapshot() -> dict[str, Any]:
    breaker_snapshot = await _GOOGLE_BREAKER.snapshot()
    rate_limiter_snapshot = await _GOOGLE_RATE_LIMITER.snapshot()
    metrics_snapshot = _GOOGLE_RESILIENCE_METRICS.snapshot()
    return {
        "active_config": _GOOGLE_EFFECTIVE_CONFIG,
        "recommended_profiles": GOOGLE_RESILIENCE_PROFILES,
        "metrics": {
            **metrics_snapshot,
            "rate_limiter_throttled_total": rate_limiter_snapshot.get("throttled_total", 0),
            "circuit_opened_total": breaker_snapshot.get("opened_total", 0),
            "circuit_short_circuit_total": breaker_snapshot.get("short_circuit_total", 0),
        },
        "breaker": breaker_snapshot,
        "rate_limiter": rate_limiter_snapshot,
    }


@dataclass
class GoogleSyncResult:
    """Unified result contract for outbox dispatchers."""

    success: bool
    event_id: Optional[str] = None
    message: str = ""


@dataclass
class GoogleWatchResult:
    """Result for channel watch registration/stop operations."""

    success: bool
    channel_id: Optional[str] = None
    resource_id: Optional[str] = None
    expiration: Optional[datetime] = None
    message: str = ""


def _to_google_event_id(appointment_id: UUID) -> str:
    """Generate deterministic Calendar event id compliant with base32hex subset."""
    return f"appt{appointment_id.hex[:60]}"


def _mask_email(value: str) -> str:
    if "@" not in value:
        return value
    local, domain = value.split("@", 1)
    if len(local) <= 2:
        return f"{local[:1]}***@{domain}"
    return f"{local[:2]}***@{domain}"


class GoogleCalendarService:
    """Facade to sync appointment lifecycle with Google Calendar."""

    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    @staticmethod
    def _is_enabled() -> bool:
        return bool(settings.google_calendar_enabled)

    @staticmethod
    def _load_service_account_info_from_env() -> tuple[dict[str, Any], str]:
        raw_b64 = (settings.google_service_account_json_base64 or "").strip()
        raw_json = (settings.google_service_account_json or "").strip()
        raw_file = (settings.google_service_account_file or "").strip()

        if raw_b64:
            try:
                decoded = base64.b64decode(raw_b64).decode("utf-8")
                return json.loads(decoded), "env:GOOGLE_SERVICE_ACCOUNT_JSON_BASE64"
            except Exception as exc:
                raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 no es un base64 JSON valido") from exc

        if raw_json:
            try:
                return json.loads(raw_json), "env:GOOGLE_SERVICE_ACCOUNT_JSON"
            except Exception as exc:
                raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON no contiene JSON valido") from exc

        if raw_file:
            sa_path = Path(raw_file).expanduser()
            if not sa_path.exists():
                raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_FILE no existe")
            try:
                return json.loads(sa_path.read_text(encoding="utf-8")), f"file:{sa_path}"
            except Exception as exc:
                raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_FILE no contiene JSON valido") from exc

        raise RuntimeError(
            "Faltan credenciales Google Service Account. Defina GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, "
            "GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_SERVICE_ACCOUNT_FILE"
        )

    @staticmethod
    def _build_service_account_credentials():
        if service_account is None:
            raise RuntimeError("google-auth no esta instalado")

        info, source = GoogleCalendarService._load_service_account_info_from_env()
        required_fields = ["client_email", "private_key", "token_uri"]
        missing = [field for field in required_fields if not info.get(field)]
        if missing:
            missing_text = ", ".join(missing)
            raise RuntimeError(f"Credenciales Google incompletas. Faltan campos requeridos: {missing_text}")

        try:
            creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
        except Exception as exc:
            raise RuntimeError("No se pudo inicializar Credentials desde Service Account") from exc

        client_email = str(info.get("client_email") or "")
        logger.info(
            "google_service_account_loaded",
            extra={
                "source": source,
                "client_email": _mask_email(client_email),
                "calendar_id": settings.google_calendar_id,
            },
        )
        return creds

    @staticmethod
    def build_calendar_client_from_env():
        """Initialize Google Calendar API client from secure environment configuration."""
        if build is None:
            raise RuntimeError("google-api-python-client no esta instalado")

        mode = (settings.google_calendar_auth_mode or "service_account").strip().lower()
        if mode != "service_account":
            raise RuntimeError("GOOGLE_CALENDAR_AUTH_MODE debe ser service_account para backend seguro")

        creds = GoogleCalendarService._build_service_account_credentials()
        return build("calendar", "v3", credentials=creds, cache_discovery=False)

    def _build_client(self):
        if build is None:
            raise RuntimeError("google-api-python-client no esta instalado")

        mode = (settings.google_calendar_auth_mode or "service_account").strip().lower()

        if mode == "service_account":
            creds = self._build_service_account_credentials()
        elif mode == "oauth2":
            if Credentials is None or InstalledAppFlow is None:
                raise RuntimeError("google-auth-oauthlib no esta instalado")

            token_path = Path(settings.google_oauth_token_file or "google_oauth_token.json").expanduser()
            secret_path = Path(settings.google_oauth_client_secret_file).expanduser()
            if not secret_path.exists():
                raise RuntimeError("GOOGLE_OAUTH_CLIENT_SECRET_FILE no existe")

            creds = None
            if token_path.exists():
                creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token and Request is not None:
                    creds.refresh(Request())
                else:
                    flow = InstalledAppFlow.from_client_secrets_file(str(secret_path), SCOPES)
                    creds = flow.run_local_server(port=0)
                if creds is None:
                    raise RuntimeError("No se pudo obtener credenciales OAuth2")
                token_path.write_text(creds.to_json(), encoding="utf-8")
        else:
            raise RuntimeError("GOOGLE_CALENDAR_AUTH_MODE invalido. Use service_account u oauth2")

        return build("calendar", "v3", credentials=creds, cache_discovery=False)

    @staticmethod
    def _is_retryable_google_error(exc: BaseException) -> bool:
        if isinstance(exc, HttpError):  # type: ignore[arg-type]
            status_code = getattr(getattr(exc, "resp", None), "status", None)
            return status_code in (429, 500, 502, 503, 504)
        # Non-HTTP exceptions are usually transport/network transient errors.
        return True

    async def _execute_google(
        self,
        call: Any,
        *,
        operation: str,
        appointment_id: UUID | None = None,
        google_event_id: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> Any:
        retry_counter = 0

        async def _once() -> Any:
            await _GOOGLE_RATE_LIMITER.acquire()
            _GOOGLE_RESILIENCE_METRICS.inc_request()
            return await asyncio.to_thread(call.execute)

        def _on_retry(exc: BaseException, attempt: int, delay: float) -> None:
            nonlocal retry_counter
            retry_counter = max(retry_counter, attempt)
            _GOOGLE_RESILIENCE_METRICS.inc_retry(delay)

            status_code = None
            if isinstance(exc, HttpError):  # type: ignore[arg-type]
                status_code = getattr(getattr(exc, "resp", None), "status", None)

            log_structured(
                logger,
                logging.WARNING,
                "google_calendar_retry",
                appointment_id=str(appointment_id) if appointment_id else None,
                google_event_id=google_event_id,
                operation=operation,
                error_type=type(exc).__name__,
                status_code=status_code,
                retries=attempt,
                retry_delay_seconds=round(delay, 3),
                payload=payload or {},
            )

        async def _with_retry() -> Any:
            return await retry_async(
                _once,
                retries=int(_GOOGLE_EFFECTIVE_CONFIG["retry_attempts"]),
                base_delay_seconds=float(_GOOGLE_EFFECTIVE_CONFIG["retry_base_delay_seconds"]),
                max_delay_seconds=float(_GOOGLE_EFFECTIVE_CONFIG["retry_max_delay_seconds"]),
                jitter_seconds=float(_GOOGLE_EFFECTIVE_CONFIG["retry_jitter_seconds"]),
                retry_predicate=self._is_retryable_google_error,
                on_retry=_on_retry,
            )

        try:
            return await _GOOGLE_BREAKER.call(_with_retry)
        except Exception as exc:
            status_code = None
            if isinstance(exc, HttpError):  # type: ignore[arg-type]
                status_code = getattr(getattr(exc, "resp", None), "status", None)

            log_structured(
                logger,
                logging.ERROR,
                "google_calendar_error",
                appointment_id=str(appointment_id) if appointment_id else None,
                google_event_id=google_event_id,
                operation=operation,
                error_type=type(exc).__name__,
                status_code=status_code,
                retries=retry_counter,
                payload=payload or {},
            )
            raise

    async def start_watch_channel(self, calendar_id: Optional[str] = None) -> GoogleWatchResult:
        """Register Google push notifications and persist channel metadata."""
        if not self._is_enabled():
            return GoogleWatchResult(success=False, message="google_calendar_disabled")

        callback_url = (settings.google_calendar_webhook_callback_url or "").strip()
        token = (settings.google_calendar_webhook_token or "").strip()
        if not callback_url:
            return GoogleWatchResult(success=False, message="missing_webhook_callback_url")
        if not token:
            return GoogleWatchResult(success=False, message="missing_webhook_token")

        client = self._build_client()
        channel_id = f"gcal-{uuid.uuid4().hex}"
        calendar_ref = calendar_id or settings.google_calendar_id

        body = {
            "id": channel_id,
            "type": "web_hook",
            "address": callback_url,
            "token": token,
            "params": {
                "ttl": str(max(60, int(settings.google_calendar_watch_ttl_seconds))),
            },
        }

        created = await self._execute_google(
            client.events().watch(calendarId=calendar_ref, body=body),
            operation="watch_start",
            payload=body,
        )
        resource_id = cast(Optional[str], created.get("resourceId"))
        expiration_ms = created.get("expiration")
        expiration_dt: Optional[datetime] = None
        if expiration_ms:
            expiration_dt = datetime.utcfromtimestamp(int(expiration_ms) / 1000)

        if not resource_id:
            return GoogleWatchResult(success=False, message="missing_resource_id")

        self.db.add(
            GoogleCalendarChannel(
                channel_id=channel_id,
                resource_id=resource_id,
                calendar_id=calendar_ref,
                webhook_token=token,
                status="active",
                expiration=expiration_dt,
            )
        )
        await self.db.commit()

        return GoogleWatchResult(
            success=True,
            channel_id=channel_id,
            resource_id=resource_id,
            expiration=expiration_dt,
        )

    async def stop_watch_channel(self, channel_id: str) -> GoogleWatchResult:
        """Stop Google watch channel and mark local record inactive."""
        channel = await self.db.scalar(
            select(GoogleCalendarChannel).where(GoogleCalendarChannel.channel_id == channel_id)
        )
        if channel is None:
            return GoogleWatchResult(success=False, message="channel_not_found")

        try:
            client = self._build_client()
            stop_body = {
                "id": cast(str, channel.channel_id),
                "resourceId": cast(str, channel.resource_id),
            }
            await self._execute_google(
                client.channels().stop(body=stop_body),
                operation="watch_stop",
                payload=stop_body,
            )
        except Exception as exc:
            logger.warning(
                "google_watch_stop_failed",
                extra={"channel_id": channel_id, "error": str(exc)},
            )

        channel.status = cast(Any, "stopped")
        await self.db.commit()
        return GoogleWatchResult(success=True, channel_id=channel_id, resource_id=cast(str, channel.resource_id))

    async def _load_appointment(self, appointment_id: UUID, for_update: bool = False) -> Optional[Appointment]:
        stmt = select(Appointment).where(Appointment.id == appointment_id)
        if for_update:
            stmt = stmt.with_for_update()
        return await self.db.scalar(stmt)

    async def _build_event_payload(self, appointment: Appointment) -> dict[str, Any]:
        doctor = await self.db.scalar(select(Doctor).where(Doctor.id == appointment.doctor_id))
        patient = await self.db.scalar(select(Patient).where(Patient.id == appointment.patient_id))

        start = appointment.date_time
        duration_raw = cast(Any, appointment.duration_minutes)
        duration_mins = int(duration_raw or "30")
        end = start + timedelta(minutes=duration_mins)

        doctor_name = getattr(doctor, "name", "Doctor")
        patient_name = getattr(patient, "name", "Paciente")

        payload = {
            "summary": "Turno medico",
            "description": (
                f"Paciente: {patient_name}\n"
                f"Doctor: {doctor_name}\n"
                f"appointment_id={appointment.id}\n"
                f"doctor_id={appointment.doctor_id}\n"
                f"patient_id={appointment.patient_id}\n"
                f"status={appointment.status}\n"
                f"reason={appointment.reason or ''}"
            ),
            "start": {
                "dateTime": start.isoformat(),
                "timeZone": settings.google_calendar_timezone,
            },
            "end": {
                "dateTime": end.isoformat(),
                "timeZone": settings.google_calendar_timezone,
            },
            "extendedProperties": {
                "private": {
                    "appointment_id": str(appointment.id),
                    "doctor_id": str(appointment.doctor_id),
                    "patient_id": str(appointment.patient_id),
                }
            },
        }
        return payload

    async def event_exists(self, event_id: str) -> bool:
        """Check whether an event exists in Google Calendar."""
        if not self._is_enabled():
            return False

        if not event_id:
            return False

        client = self._build_client()
        try:
            await self._execute_google(
                client.events().get(
                    calendarId=settings.google_calendar_id,
                    eventId=event_id,
                ),
                operation="event_exists",
                google_event_id=event_id,
            )
            return True
        except HttpError as exc:  # type: ignore[misc]
            status_code = getattr(getattr(exc, "resp", None), "status", None)
            if status_code == 404:
                return False
            raise

    async def create_google_event(self, appointment: Appointment) -> GoogleSyncResult:
        """Create Google Calendar event for an already committed appointment.

        This function is idempotent. It only runs after DB commit and updates
        google_event_id / google_sync_status without reverting the appointment.
        """
        current_google_event_id = cast(Optional[str], cast(Any, appointment.google_event_id))
        status = str(cast(Any, appointment.status) or "").lower()
        if status == "cancelled":
            appointment.google_sync_status = cast(Any, "failed")
            await self.db.flush()
            log_structured(
                logger,
                logging.INFO,
                "google_calendar_create_event_skipped",
                appointment_id=str(appointment.id),
                google_event_id=current_google_event_id,
                status="cancelled_appointment_not_syncable",
            )
            return GoogleSyncResult(success=False, message="cancelled_appointment_not_syncable")

        if current_google_event_id:
            appointment.google_sync_status = cast(Any, "synced")
            await self.db.flush()
            log_structured(
                logger,
                logging.INFO,
                "google_calendar_create_event",
                appointment_id=str(appointment.id),
                google_event_id=current_google_event_id,
                status="already_synced",
            )
            return GoogleSyncResult(success=True, event_id=current_google_event_id, message="already_synced")

        client = self._build_client()
        event_payload = await self._build_event_payload(appointment)
        deterministic_event_id = _to_google_event_id(cast(UUID, appointment.id))

        try:
            created = await self._execute_google(
                client.events().insert(
                    calendarId=settings.google_calendar_id,
                    eventId=deterministic_event_id,
                    body=event_payload,
                    conferenceDataVersion=0,
                    sendUpdates="none",
                ),
                operation="create_event",
                appointment_id=cast(UUID, appointment.id),
                google_event_id=deterministic_event_id,
                payload=event_payload,
            )
            event_id = cast(Optional[str], created.get("id")) or deterministic_event_id
            appointment.google_event_id = cast(Any, event_id)
            appointment.google_sync_status = cast(Any, "synced")
            await self.db.flush()
            log_structured(
                logger,
                logging.INFO,
                "google_calendar_create_event",
                appointment_id=str(appointment.id),
                google_event_id=event_id,
                status="synced",
            )
            return GoogleSyncResult(success=True, event_id=event_id)
        except HttpError as exc:  # type: ignore[misc]
            status_code = getattr(getattr(exc, "resp", None), "status", None)
            if status_code == 409:
                appointment.google_event_id = cast(Any, deterministic_event_id)
                appointment.google_sync_status = cast(Any, "synced")
                await self.db.flush()
                log_structured(
                    logger,
                    logging.INFO,
                    "google_calendar_create_event",
                    appointment_id=str(appointment.id),
                    google_event_id=deterministic_event_id,
                    status="already_exists",
                )
                return GoogleSyncResult(success=True, event_id=deterministic_event_id, message="already_exists")

            appointment.google_sync_status = cast(Any, "failed")
            await self.db.flush()
            log_structured(
                logger,
                logging.ERROR,
                "google_calendar_create_event",
                appointment_id=str(appointment.id),
                google_event_id=deterministic_event_id,
                status="failed",
            )
            return GoogleSyncResult(success=False, message=f"google_http_error:{status_code or 'unknown'}")
        except Exception as exc:
            appointment.google_sync_status = cast(Any, "failed")
            await self.db.flush()
            log_structured(
                logger,
                logging.ERROR,
                "google_calendar_create_event",
                appointment_id=str(appointment.id),
                google_event_id=deterministic_event_id,
                status="failed",
            )
            return GoogleSyncResult(success=False, message=str(exc))

    async def create_event_for_appointment(self, appointment_id: UUID) -> GoogleSyncResult:
        """Idempotent create: avoid duplicates by deterministic event id and stored google_event_id."""
        if not self._is_enabled():
            return GoogleSyncResult(success=True, message="google_calendar_disabled")

        appointment = await self._load_appointment(appointment_id, for_update=True)
        if appointment is None:
            return GoogleSyncResult(success=True, message="appointment_not_found")
        return await self.create_google_event(appointment)

    async def update_event_for_appointment(self, appointment_id: UUID) -> GoogleSyncResult:
        """Update appointment event; if missing event id, create it."""
        if not self._is_enabled():
            return GoogleSyncResult(success=True, message="google_calendar_disabled")

        appointment = await self._load_appointment(appointment_id, for_update=True)
        if appointment is None:
            return GoogleSyncResult(success=True, message="appointment_not_found")

        status = str(cast(Any, appointment.status) or "").lower()
        if status == "cancelled":
            appointment.google_sync_status = cast(Any, "failed")
            await self.db.flush()
            log_structured(
                logger,
                logging.INFO,
                "google_calendar_update_event_skipped",
                appointment_id=str(appointment_id),
                google_event_id=cast(Optional[str], cast(Any, appointment.google_event_id)),
                status="cancelled_appointment_not_syncable",
            )
            return GoogleSyncResult(success=False, message="cancelled_appointment_not_syncable")

        current_google_event_id = cast(Optional[str], cast(Any, appointment.google_event_id))
        if not current_google_event_id:
            return await self.create_event_for_appointment(appointment_id)

        client = self._build_client()
        event_payload = await self._build_event_payload(appointment)

        try:
            updated = await self._execute_google(
                client.events().patch(
                    calendarId=settings.google_calendar_id,
                    eventId=current_google_event_id,
                    body=event_payload,
                    sendUpdates="none",
                ),
                operation="update_event",
                appointment_id=appointment_id,
                google_event_id=current_google_event_id,
                payload=event_payload,
            )
            event_id = cast(Optional[str], updated.get("id")) or current_google_event_id
            appointment.google_event_id = cast(Any, event_id)
            appointment.google_sync_status = cast(Any, "synced")
            await self.db.flush()
            return GoogleSyncResult(success=True, event_id=event_id)
        except HttpError as exc:  # type: ignore[misc]
            status_code = getattr(getattr(exc, "resp", None), "status", None)
            if status_code == 404:
                appointment.google_event_id = cast(Any, None)
                appointment.google_sync_status = cast(Any, "pending")
                await self.db.flush()
                return await self.create_event_for_appointment(appointment_id)
            raise

    async def delete_event_for_appointment(self, appointment_id: UUID) -> GoogleSyncResult:
        """Delete event from Calendar; idempotent when event already removed."""
        if not self._is_enabled():
            return GoogleSyncResult(success=True, message="google_calendar_disabled")

        appointment = await self._load_appointment(appointment_id, for_update=True)
        if appointment is None:
            return GoogleSyncResult(success=True, message="appointment_not_found")

        current_google_event_id = cast(Optional[str], cast(Any, appointment.google_event_id))
        if not current_google_event_id:
            appointment.google_sync_status = cast(Any, "synced")
            await self.db.flush()
            return GoogleSyncResult(success=True, message="already_deleted")

        client = self._build_client()
        event_id = current_google_event_id

        try:
            await self._execute_google(
                client.events().delete(
                    calendarId=settings.google_calendar_id,
                    eventId=event_id,
                    sendUpdates="none",
                ),
                operation="delete_event",
                appointment_id=appointment_id,
                google_event_id=event_id,
                payload={"calendar_id": settings.google_calendar_id, "event_id": event_id},
            )
        except HttpError as exc:  # type: ignore[misc]
            status_code = getattr(getattr(exc, "resp", None), "status", None)
            if status_code != 404:
                raise

        appointment.google_event_id = cast(Any, None)
        appointment.google_sync_status = cast(Any, "synced")
        await self.db.flush()
        return GoogleSyncResult(success=True, event_id=event_id)
