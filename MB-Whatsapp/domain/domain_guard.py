from __future__ import annotations

from typing import Final

DOMAIN_NAME: Final[str] = "MB-Whatsapp"

ALLOWED_ASSISTANT_MODES: Final[frozenset[str]] = frozenset(
    {
        "appointment_booking",
        "whatsapp_booking",
        "whatsapp_conversation",
    }
)

ALLOWED_CAPABILITIES: Final[frozenset[str]] = frozenset(
    {
        "agenda_api.client",
        "appointment_booking",
        "appointment.search_availability",
        "appointment.confirm",
        "appointment.cancel",
        "appointment.reschedule",
        "conversation.whatsapp",
        "whatsapp_transport",
        "whatsapp_booking",
        "contracts",
        "validators",
        "auth",
        "tenant",
        "logging",
        "provider.groq.whatsapp",
    }
)

DISABLED_CAPABILITIES: Final[frozenset[str]] = frozenset(
    {
        "clinical_diagnosis",
        "clinical.reasoning",
        "deep_clinical_reasoning",
        "doctor_professional",
        "clinical_support",
        "secretary_ingestion",
        "spreadsheet_ingestion",
        "document_parsing",
        "full_clinical_history_access",
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
