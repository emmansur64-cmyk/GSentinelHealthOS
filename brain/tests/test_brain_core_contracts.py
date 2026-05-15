from __future__ import annotations

import pytest

from brain.contracts.core_contracts import (
    ContractValidationError,
    evaluate_mode_guard,
    validate_brain_core_response,
    validate_chat_brain_request,
    validate_secretary_brain_request,
    validate_whatsapp_brain_request,
)


def _base_chat_payload() -> dict:
    return {
        "request_id": "req-chat-1",
        "tenant_id": "tenant-1",
        "actor_id": "doctor-1",
        "actor_role": "doctor",
        "assistant_mode": "doctor_professional",
        "channel": "web_chat",
        "message": "Resumen rapido del caso",
        "allowed_tools": ["clinical.chat_response"],
        "forbidden_tools": ["appointment_write", "whatsapp_send", "spreadsheet_ingest"],
    }


def _base_secretary_payload() -> dict:
    return {
        "request_id": "req-sec-1",
        "tenant_id": "tenant-1",
        "actor_id": "sec-1",
        "actor_role": "secretary",
        "assistant_mode": "secretary_ingestion",
        "channel": "web_upload",
        "document_ref": "doc://import/1",
        "import_mode": "preview",
        "allowed_tools": ["document.parse_preview"],
        "forbidden_tools": ["clinical_diagnosis", "whatsapp_send", "full_clinical_history_access"],
    }


def _base_whatsapp_payload() -> dict:
    return {
        "request_id": "req-wa-1",
        "tenant_id": "tenant-1",
        "channel": "whatsapp",
        "whatsapp_message_id": "wamid-1",
        "patient_phone_ref": "phone-ref-1",
        "message": "Quiero un turno",
        "assistant_mode": "appointment_booking",
        "allowed_tools": ["appointment.search_availability"],
        "forbidden_tools": [
            "clinical_diagnosis",
            "full_clinical_history_access",
            "spreadsheet_ingest",
        ],
    }


def _base_response_payload() -> dict:
    return {
        "request_id": "req-1",
        "assistant_mode": "appointment_booking",
        "decision": "propose",
        "confidence": 0.9,
        "safe_response": "Ok",
        "proposed_actions": ["appointment.search_availability"],
        "requires_human_review": False,
        "audit_tags": ["safe"],
        "forbidden_action_detected": False,
    }


def test_chat_request_rejects_appointment_write() -> None:
    payload = _base_chat_payload()
    payload["allowed_tools"] = ["appointment_write"]

    with pytest.raises(ContractValidationError, match="allowed_tools contains prohibited tools"):
        validate_chat_brain_request(payload)


def test_whatsapp_request_rejects_clinical_diagnosis() -> None:
    payload = _base_whatsapp_payload()
    payload["allowed_tools"] = ["clinical_diagnosis"]

    with pytest.raises(ContractValidationError, match="allowed_tools contains prohibited tools"):
        validate_whatsapp_brain_request(payload)


def test_secretary_request_rejects_full_history_access() -> None:
    payload = _base_secretary_payload()
    payload["allowed_tools"] = ["full_clinical_history_access"]

    with pytest.raises(ContractValidationError, match="allowed_tools contains prohibited tools"):
        validate_secretary_brain_request(payload)


def test_brain_core_response_rejects_action_outside_allowlist() -> None:
    payload = _base_response_payload()
    payload["proposed_actions"] = ["db.raw_sql"]

    with pytest.raises(ContractValidationError, match="brain action not allowed"):
        validate_brain_core_response(payload)


def test_unknown_assistant_mode_fails_closed() -> None:
    payload = _base_response_payload()
    payload["assistant_mode"] = "unknown_mode"

    with pytest.raises(ContractValidationError, match="assistant_mode is unknown"):
        validate_brain_core_response(payload)


def test_allowed_and_forbidden_tools_are_enforced() -> None:
    valid_chat = _base_chat_payload()
    validate_chat_brain_request(valid_chat)

    invalid_chat = _base_chat_payload()
    invalid_chat["forbidden_tools"] = ["appointment_write"]
    with pytest.raises(ContractValidationError, match="forbidden_tools must include"):
        validate_chat_brain_request(invalid_chat)


def test_mode_guard_blocks_cross_domain_tools() -> None:
    result = evaluate_mode_guard("doctor_professional", "appointment.write")
    assert result.allowed is False

    result = evaluate_mode_guard("appointment_booking", "clinical.diagnosis")
    assert result.allowed is False

    result = evaluate_mode_guard("secretary_ingestion", "clinical.history.full_access")
    assert result.allowed is False

    result = evaluate_mode_guard("doctor_professional", "clinical.chat_response")
    assert result.allowed is True
