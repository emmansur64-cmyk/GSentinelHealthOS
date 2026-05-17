"""Política PHI centralizada para GSentinelHealthOS.

Consolida en un único punto:
- Retención de datos PHI (días por categoría)
- Validación de prerequisitos de compliance en startup
- Guard de consentimiento requerido por operación
- Clasificación de qué campos son PHI

No contiene lógica de negocio ni acceso a DB. Es importable sin side-effects.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import timedelta
from typing import ClassVar


# ── Clasificación de campos PHI ───────────────────────────────────────────────

#: Campos de modelos que contienen PHI directa (identificadores personales).
PHI_DIRECT_FIELDS: frozenset[str] = frozenset({
    "name", "full_name", "patient_name",
    "dni", "phone", "phone_hash",
    "email", "age",
    "patient_full_name", "patient_dni", "patient_phone", "patient_email", "patient_age",
    "reason", "notes",
    "whatsapp_conversation_id",
})

#: Campos de PHI indirecta (identifican al paciente combinados con otros datos).
PHI_INDIRECT_FIELDS: frozenset[str] = frozenset({
    "date_time",        # fecha/hora + doctor_id identifica al paciente
    "doctor_id",
    "clinic_id",
    "client_id",
    "specialty",
    "source",
    "created_by",
})

#: Claves que NUNCA deben llegar a un LLM externo (usado por hybrid_decision y providers).
PHI_LLM_BLOCKED_KEYS: frozenset[str] = frozenset({
    "phone", "telefono", "tel",
    "email", "correo",
    "name", "nombre", "full_name", "nombre_completo", "patient_name",
    "dni", "document", "documento", "passport", "pasaporte", "rut", "cuit", "cuil",
    "address", "direccion", "domicilio",
    "birth_date", "fecha_nacimiento", "dob",
    "patient_id", "paciente_id",
})


# ── Política de retención ─────────────────────────────────────────────────────

def _env_int(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(default)).strip()))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class RetentionPolicy:
    """Política de retención de datos PHI por categoría.

    Los valores por defecto siguen la recomendación HIPAA (mínimo 6 años)
    y la práctica argentina para historia clínica (10-15 años).
    Configurable via variables de entorno para adecuarse a cada jurisdicción.
    """

    #: Días de retención para registros de pacientes con datos directos.
    patient_records_days: int = field(
        default_factory=lambda: _env_int("PHI_RETENTION_PATIENT_DAYS", 3650)  # 10 años
    )
    #: Días de retención para citas (incluye razón clínica cifrada).
    appointment_records_days: int = field(
        default_factory=lambda: _env_int("PHI_RETENTION_APPOINTMENT_DAYS", 3650)  # 10 años
    )
    #: Días de retención para logs de acceso PHI.
    access_log_days: int = field(
        default_factory=lambda: _env_int("PHI_RETENTION_ACCESS_LOG_DAYS", 2190)  # 6 años
    )
    #: Días de retención para registros de consentimiento.
    consent_records_days: int = field(
        default_factory=lambda: _env_int("PHI_RETENTION_CONSENT_DAYS", 3650)  # 10 años
    )

    def patient_ttl(self) -> timedelta:
        return timedelta(days=self.patient_records_days)

    def appointment_ttl(self) -> timedelta:
        return timedelta(days=self.appointment_records_days)

    def access_log_ttl(self) -> timedelta:
        return timedelta(days=self.access_log_days)

    def consent_ttl(self) -> timedelta:
        return timedelta(days=self.consent_records_days)


# Singleton cargado una vez en runtime
RETENTION_POLICY = RetentionPolicy()


# ── Tipos de acceso PHI para audit log ───────────────────────────────────────

class PHIAccessType:
    """Constantes para el campo access_type en PatientAccessLog."""

    READ = "read"
    LIST = "list"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"  # soft delete
    EXPORT = "export"
    SEARCH = "search"


# ── Tipos de consentimiento ───────────────────────────────────────────────────

class ConsentType:
    """Categorías de consentimiento informado."""

    DATA_PROCESSING = "data_processing"       # RGPD/GDPR art. 6
    CLINICAL_HISTORY = "clinical_history"     # Historia clínica
    WHATSAPP_COMMS = "whatsapp_communications" # Mensajes vía WhatsApp (Meta)
    AI_PROCESSING = "ai_processing"           # Procesamiento por IA


# ── Validación de prerequisitos de compliance ─────────────────────────────────

@dataclass
class ComplianceCheckResult:
    """Resultado de la validación de prerequisitos PHI en startup."""

    passed: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def raise_if_failed(self) -> None:
        if not self.passed:
            raise RuntimeError(
                f"PHI compliance startup check FAILED:\n"
                + "\n".join(f"  ERROR: {e}" for e in self.errors)
            )


def validate_phi_compliance_startup() -> ComplianceCheckResult:
    """Valida que los prerequisitos de PHI compliance estén configurados.

    Llamar en el evento startup de FastAPI. Lanza RuntimeError si falla algún
    check BLOQUEANTE. Los warnings se loguean pero no bloquean el arranque.
    """
    errors: list[str] = []
    warnings: list[str] = []

    # 1. SECRET_ENCRYPTION_KEY debe estar configurada (cifrado de PHI en DB)
    from shared.security.secrets import is_secret_encryption_key_configured
    if not is_secret_encryption_key_configured():
        errors.append(
            "SECRET_ENCRYPTION_KEY no configurada: los campos PHI (phone, DNI, reason, notes) "
            "no pueden cifrarse en base de datos. Riesgo crítico de exposición."
        )

    # 2. ENV debe ser explícito (no puede correr en producción sin ENV=production)
    env = os.getenv("ENV", "").strip().lower()
    if not env:
        warnings.append("ENV no configurada — asegurarse de definir ENV=production en despliegue.")
    elif env == "production" and not os.getenv("SECRET_ENCRYPTION_KEY", "").strip():
        errors.append("ENV=production sin SECRET_ENCRYPTION_KEY: BLOQUEANTE para producción PHI.")

    # 3. PHI_AUDIT_LOG_ENABLED recomendado en producción
    audit_enabled = os.getenv("PHI_AUDIT_LOG_ENABLED", "true").strip().lower()
    if env == "production" and audit_enabled not in {"1", "true", "yes", "on"}:
        warnings.append(
            "PHI_AUDIT_LOG_ENABLED no activo en producción: "
            "los accesos a datos de pacientes no quedarán auditados."
        )

    # 4. PHI_SOFT_DELETE_ENABLED recomendado
    soft_delete = os.getenv("PHI_SOFT_DELETE_ENABLED", "true").strip().lower()
    if env == "production" and soft_delete not in {"1", "true", "yes", "on"}:
        warnings.append(
            "PHI_SOFT_DELETE_ENABLED no activo en producción: "
            "los borrados de pacientes serán permanentes sin posibilidad de auditoría."
        )

    passed = len(errors) == 0
    return ComplianceCheckResult(passed=passed, errors=errors, warnings=warnings)


def phi_audit_log_enabled() -> bool:
    """True cuando el log de acceso PHI está activo (default: true)."""
    val = os.getenv("PHI_AUDIT_LOG_ENABLED", "true").strip().lower()
    return val in {"1", "true", "yes", "on"}


def phi_soft_delete_enabled() -> bool:
    """True cuando se usa soft-delete en lugar de hard-delete (default: true)."""
    val = os.getenv("PHI_SOFT_DELETE_ENABLED", "true").strip().lower()
    return val in {"1", "true", "yes", "on"}
