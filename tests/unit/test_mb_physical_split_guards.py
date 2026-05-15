from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

from brain.contracts.core_contracts import ContractValidationError, validate_runtime_brain_request
from brain.contracts.routing import AssistantMode, build_contract


ROOT = Path(__file__).resolve().parents[2]


def _load_domain(folder: str):
    package_dir = ROOT / folder / "domain"
    spec = importlib.util.spec_from_file_location(
        f"{folder.lower().replace('-', '_')}_domain",
        package_dir / "__init__.py",
        submodule_search_locations=[str(package_dir)],
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_mb_chat_blocks_whatsapp_booking_and_secretary_ingestion() -> None:
    domain = _load_domain("MB-Chat")

    assert domain.is_capability_allowed("clinical.chat") is True
    assert domain.is_capability_allowed("provider.groq.chat") is True

    for blocked in ("whatsapp_booking", "whatsapp_transport", "secretary_ingestion", "appointment.write"):
        with pytest.raises(domain.DomainCapabilityError):
            domain.assert_capability_allowed(blocked)


def test_mb_whatsapp_blocks_diagnosis_and_spreadsheet_ingestion() -> None:
    domain = _load_domain("MB-Whatsapp")

    assert domain.is_capability_allowed("whatsapp_transport") is True
    assert domain.is_capability_allowed("agenda_api.client") is True

    for blocked in ("clinical_diagnosis", "deep_clinical_reasoning", "spreadsheet_ingestion", "doctor_professional"):
        with pytest.raises(domain.DomainCapabilityError):
            domain.assert_capability_allowed(blocked)


def test_mb_secretaria_blocks_doctor_professional_and_patient_chat() -> None:
    domain = _load_domain("MB-Secretaria")

    assert domain.is_capability_allowed("secretary_ingestion") is True
    assert domain.is_capability_allowed("document_parsing") is True

    for blocked in ("doctor_professional", "clinical_diagnosis", "patient_facing_chat", "whatsapp_booking"):
        with pytest.raises(domain.DomainCapabilityError):
            domain.assert_capability_allowed(blocked)


def test_invalid_assistant_mode_fails_closed_in_contracts() -> None:
    contract = build_contract(mode_raw="invalid_mode", actor_role_raw="doctor")

    assert contract.mode == AssistantMode.GENERIC_NON_CLINICAL
    assert contract.capabilities.triage_allowed is False
    assert contract.capabilities.clinical_reasoning_allowed is False

    with pytest.raises(ContractValidationError):
        validate_runtime_brain_request(
            {
                "request_id": "req-1",
                "tenant_id": "tenant-1",
                "actor_id": "actor-1",
                "actor_role": "doctor",
                "assistant_mode": "invalid_mode",
                "channel": "web_chat",
                "message": "hola",
                "allowed_tools": [],
                "forbidden_tools": [],
            }
        )


def test_provider_config_is_domain_isolated_without_generic_groq_fallback() -> None:
    cases = {
        "MB-Chat": ("GROQ_API_KEY_CHAT", "GROQ_MODEL_CHAT"),
        "MB-Secretaria": ("GROQ_API_KEY_SECRETARIA", "GROQ_MODEL_SECRETARIA"),
        "MB-Whatsapp": ("GROQ_API_KEY_WHATSAPP", "GROQ_MODEL_WHATSAPP"),
    }

    for folder, (key_env, model_env) in cases.items():
        domain = _load_domain(folder)
        generic_only = domain.load_provider_config({"GROQ_API_KEY": "generic-secret"})
        domain_specific = domain.load_provider_config({key_env: "domain-secret", model_env: "domain-model"})

        assert generic_only.api_key_configured is False
        assert generic_only.api_key_env == key_env
        assert generic_only.model_env == model_env
        assert domain_specific.api_key_configured is True
        assert domain_specific.model == "domain-model"


def test_agenda_api_client_contract_still_exposes_appointment_operations() -> None:
    client_path = ROOT / "brain" / "integration" / "api_client.py"
    content = client_path.read_text(encoding="utf-8")
    appointments_endpoint = (ROOT / "api" / "app" / "api" / "v1" / "endpoints" / "appointments.py").read_text(
        encoding="utf-8"
    )
    slots_endpoint = (
        ROOT / "api" / "app" / "api" / "v1" / "endpoints" / "time_slots_simple.py"
    ).read_text(encoding="utf-8")

    for method in (
        "create_appointment",
        "get_patient_appointments",
        "get_doctor_appointments",
        "cancel_appointment",
    ):
        assert f"async def {method}" in content

    assert '"/api/v1/appointments"' in content
    assert '"/gateway/validate-slot"' in appointments_endpoint
    assert '"/available"' in slots_endpoint
