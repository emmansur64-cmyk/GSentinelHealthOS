"""Minimal Brain Core contracts for MB domain isolation.

This module is intentionally standalone and side-effect free.
It does not change runtime routing yet; it defines validated contracts
for Phase 1 and can be adopted incrementally by callers.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping


CHAT_ASSISTANT_MODES = {"doctor_professional", "clinical_support"}
SECRETARY_ASSISTANT_MODE = "secretary_ingestion"
WHATSAPP_ASSISTANT_MODE = "appointment_booking"

CHAT_CHANNEL = "web_chat"
SECRETARY_CHANNELS = {"web_upload", "admin_panel"}
WHATSAPP_CHANNEL = "whatsapp"

BRAIN_ACTION_ALLOWLIST = {
    "appointment.search_availability",
    "appointment.create_proposal",
    "appointment.confirm",
    "appointment.cancel_request",
    "appointment.reschedule_request",
    "document.parse_preview",
    "document.import_schedule",
    "clinical.chat_response",
    "human.escalate",
}

CHAT_PROHIBITED_TOOLS = {"appointment_write", "whatsapp_send", "spreadsheet_ingest"}
SECRETARY_PROHIBITED_TOOLS = {
    "clinical_diagnosis",
    "whatsapp_send",
    "full_clinical_history_access",
}
WHATSAPP_PROHIBITED_TOOLS = {
    "clinical_diagnosis",
    "full_clinical_history_access",
    "spreadsheet_ingest",
}

KNOWN_ASSISTANT_MODES = CHAT_ASSISTANT_MODES | {
    SECRETARY_ASSISTANT_MODE,
    WHATSAPP_ASSISTANT_MODE,
}


class ContractValidationError(ValueError):
    """Raised when an input/output contract is invalid."""


@dataclass(frozen=True)
class ModeGuardResult:
    allowed: bool
    reason: str


def _require_fields(payload: Mapping[str, Any], required: Iterable[str]) -> None:
    missing = [field for field in required if field not in payload or payload[field] in (None, "")]
    if missing:
        raise ContractValidationError(f"missing required fields: {', '.join(missing)}")


def _to_tool_set(payload: Mapping[str, Any], key: str) -> set[str]:
    raw = payload.get(key, [])
    if raw is None:
        return set()
    if not isinstance(raw, list):
        raise ContractValidationError(f"{key} must be a list")
    out: set[str] = set()
    for item in raw:
        if not isinstance(item, str):
            raise ContractValidationError(f"{key} contains non-string value")
        tool = item.strip()
        if tool:
            out.add(tool)
    return out


def _validate_forbidden_tools(
    allowed_tools: set[str],
    forbidden_tools: set[str],
    prohibited_by_contract: set[str],
) -> None:
    conflicting = allowed_tools & prohibited_by_contract
    if conflicting:
        raise ContractValidationError(
            f"allowed_tools contains prohibited tools: {', '.join(sorted(conflicting))}"
        )

    missing_forbidden = prohibited_by_contract - forbidden_tools
    if missing_forbidden:
        raise ContractValidationError(
            f"forbidden_tools must include: {', '.join(sorted(missing_forbidden))}"
        )


def validate_chat_brain_request(payload: Mapping[str, Any]) -> None:
    _require_fields(
        payload,
        [
            "request_id",
            "tenant_id",
            "actor_id",
            "actor_role",
            "assistant_mode",
            "channel",
            "message",
        ],
    )
    if payload.get("assistant_mode") not in CHAT_ASSISTANT_MODES:
        raise ContractValidationError("chat assistant_mode must be doctor_professional or clinical_support")
    if payload.get("channel") != CHAT_CHANNEL:
        raise ContractValidationError("chat channel must be web_chat")

    allowed_tools = _to_tool_set(payload, "allowed_tools")
    forbidden_tools = _to_tool_set(payload, "forbidden_tools")
    _validate_forbidden_tools(allowed_tools, forbidden_tools, CHAT_PROHIBITED_TOOLS)


def validate_secretary_brain_request(payload: Mapping[str, Any]) -> None:
    _require_fields(
        payload,
        [
            "request_id",
            "tenant_id",
            "actor_id",
            "actor_role",
            "assistant_mode",
            "channel",
            "document_ref",
            "import_mode",
        ],
    )
    if payload.get("assistant_mode") != SECRETARY_ASSISTANT_MODE:
        raise ContractValidationError("secretary assistant_mode must be secretary_ingestion")
    if payload.get("actor_role") not in {"secretary", "admin"}:
        raise ContractValidationError("secretary actor_role must be secretary or admin")
    if payload.get("channel") not in SECRETARY_CHANNELS:
        raise ContractValidationError("secretary channel must be web_upload or admin_panel")
    if payload.get("import_mode") not in {"preview", "apply"}:
        raise ContractValidationError("import_mode must be preview or apply")

    allowed_tools = _to_tool_set(payload, "allowed_tools")
    forbidden_tools = _to_tool_set(payload, "forbidden_tools")
    _validate_forbidden_tools(allowed_tools, forbidden_tools, SECRETARY_PROHIBITED_TOOLS)


def validate_whatsapp_brain_request(payload: Mapping[str, Any]) -> None:
    _require_fields(
        payload,
        [
            "request_id",
            "tenant_id",
            "channel",
            "whatsapp_message_id",
            "message",
            "assistant_mode",
        ],
    )
    if payload.get("assistant_mode") != WHATSAPP_ASSISTANT_MODE:
        raise ContractValidationError("whatsapp assistant_mode must be appointment_booking")
    if payload.get("channel") != WHATSAPP_CHANNEL:
        raise ContractValidationError("whatsapp channel must be whatsapp")
    has_phone_ref = bool(payload.get("patient_phone_ref")) or bool(payload.get("phone_hash"))
    if not has_phone_ref:
        raise ContractValidationError("whatsapp request requires patient_phone_ref or phone_hash")

    allowed_tools = _to_tool_set(payload, "allowed_tools")
    forbidden_tools = _to_tool_set(payload, "forbidden_tools")
    _validate_forbidden_tools(allowed_tools, forbidden_tools, WHATSAPP_PROHIBITED_TOOLS)


def validate_brain_action(action: str) -> None:
    if action not in BRAIN_ACTION_ALLOWLIST:
        raise ContractValidationError(f"brain action not allowed: {action}")


def validate_brain_core_response(payload: Mapping[str, Any]) -> None:
    _require_fields(
        payload,
        [
            "request_id",
            "assistant_mode",
            "decision",
            "confidence",
            "safe_response",
            "proposed_actions",
            "requires_human_review",
            "audit_tags",
            "forbidden_action_detected",
        ],
    )
    mode = payload.get("assistant_mode")
    if mode not in KNOWN_ASSISTANT_MODES:
        raise ContractValidationError("assistant_mode is unknown; fail closed")

    proposed_actions = payload.get("proposed_actions")
    if not isinstance(proposed_actions, list):
        raise ContractValidationError("proposed_actions must be a list")
    for action in proposed_actions:
        if not isinstance(action, str):
            raise ContractValidationError("proposed_actions contains non-string value")
        validate_brain_action(action)


def evaluate_mode_guard(mode: str, requested_tool: str) -> ModeGuardResult:
    """Return allow/deny for mode-tool pairs in a fail-closed manner."""
    normalized_mode = str(mode or "").strip()
    normalized_tool = str(requested_tool or "").strip()

    if normalized_mode == "doctor_professional" and normalized_tool in {"triage.patient_facing", "appointment.write"}:
        return ModeGuardResult(False, "doctor_professional cannot run patient triage or write agenda")

    if normalized_mode == "appointment_booking" and normalized_tool in {
        "clinical.diagnosis",
        "clinical.history.full_access",
        "clinical.deep_tool",
    }:
        return ModeGuardResult(False, "appointment_booking cannot perform clinical actions")

    if normalized_mode == "secretary_ingestion" and normalized_tool in {
        "clinical.history.full_access",
        "clinical.diagnosis",
        "whatsapp.send",
    }:
        return ModeGuardResult(False, "secretary_ingestion cannot access full clinical context")

    if normalized_mode not in KNOWN_ASSISTANT_MODES:
        return ModeGuardResult(False, "unknown assistant mode")

    return ModeGuardResult(True, "allowed")
