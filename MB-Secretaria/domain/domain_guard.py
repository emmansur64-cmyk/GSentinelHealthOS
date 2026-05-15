from __future__ import annotations

from typing import Final

DOMAIN_NAME: Final[str] = "MB-Secretaria"

ALLOWED_ASSISTANT_MODES: Final[frozenset[str]] = frozenset(
    {
        "secretary_ingestion",
        "schedule_import",
        "availability_normalization",
    }
)

ALLOWED_CAPABILITIES: Final[frozenset[str]] = frozenset(
    {
        "agenda_api.client",
        "agenda_api_prepare_payload",
        "availability.normalization",
        "availability_normalization",
        "audit_report_generation",
        "document_parsing",
        "schedule_preview",
        "spreadsheet_ingestion",
        "secretary_ingestion",
        "contracts",
        "validators",
        "auth",
        "tenant",
        "logging",
        "provider.groq.secretaria",
    }
)

DISABLED_CAPABILITIES: Final[frozenset[str]] = frozenset(
    {
        "clinical_diagnosis",
        "clinical.reasoning",
        "deep_clinical_reasoning",
        "doctor_professional",
        "clinical_support",
        "patient_facing_chat",
        "patient_triage_auto",
        "triage",
        "clinical_triage",
        "imaging",
        "medical_imaging",
        "radiology",
        "dicom",
        "whatsapp",
        "whatsapp_webhook",
        "whatsapp_send",
        "whatsapp_transport",
        "whatsapp_booking",
        "direct_db_mutation",
        "db.direct_write",
        "prisma.write",
        "raw_sql",
        "patient_medical_advice",
        "emergency_classification",
    }
)


class DomainCapabilityError(PermissionError):
    """Raised when a capability is outside the physical MB domain."""


def is_capability_allowed(capability: str) -> bool:
    normalized = capability.strip()
    return normalized in ALLOWED_CAPABILITIES and normalized not in DISABLED_CAPABILITIES


def assert_capability_allowed(capability: str) -> None:
    if not is_capability_allowed(capability):
        raise DomainCapabilityError(f"{DOMAIN_NAME} blocks capability: {capability}")


def assert_assistant_mode_allowed(assistant_mode: str) -> None:
    normalized = assistant_mode.strip()
    if normalized not in ALLOWED_ASSISTANT_MODES:
        raise DomainCapabilityError(f"{DOMAIN_NAME} blocks assistant_mode: {assistant_mode}")
