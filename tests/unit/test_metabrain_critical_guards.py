from __future__ import annotations

import asyncio

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.requests import Request

from api.app.core import security
from api.app.api.v1.endpoints import webhooks_whatsapp
from brain.contracts.routing import RoutingDecision, build_contract
from brain.routing.role_router import RoleRouter
from whatsapp_gateway.api.routes import webhook as gateway_webhook


def _request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/unit",
            "headers": [],
            "client": ("127.0.0.1", 50000),
        }
    )


def test_sensitive_endpoint_rejects_internal_key_without_required_scope(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(security, "INTERNAL_API_KEYS", {"gateway": "gateway-key", "brain": "brain-key"})
    monkeypatch.setattr(
        security,
        "API_KEY_SCOPES",
        {
            "gateway": ["appointments:create"],
            "brain": ["appointments:read"],
        },
    )

    with pytest.raises(Exception) as excinfo:
        asyncio.run(
            security.validate_hybrid_auth(
                request=_request(),
                x_internal_key="brain-key",
                required_scope="appointments:create",
            )
        )

    assert getattr(excinfo.value, "status_code", None) == 403


def test_gateway_webhook_enqueues_once_without_clinical_execution(monkeypatch: pytest.MonkeyPatch) -> None:
    class Queue:
        def __init__(self) -> None:
            self.messages: list[dict] = []

        async def publish(self, message: dict) -> bool:
            self.messages.append(message)
            return True

    class Resolver:
        async def get_by_phone_number_id(self, phone_number_id: str):
            return type(
                "Account",
                (),
                {
                    "client_id": "tenant-1",
                    "clinic_id": "clinic-1",
                    "phone_number_id": phone_number_id,
                    "access_token": "token",
                    "app_secret": "secret",
                },
            )()

    queue = Queue()
    monkeypatch.setattr(gateway_webhook, "queue_service", queue)
    monkeypatch.setattr(gateway_webhook, "account_resolver", Resolver())
    monkeypatch.setattr(gateway_webhook.whatsapp_service, "verify_signature", lambda body, signature, app_secret=None: True)
    monkeypatch.setattr(gateway_webhook, "WHATSAPP_APP_SECRET", "secret")

    app = FastAPI()
    app.include_router(gateway_webhook.router)
    client = TestClient(app)

    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "metadata": {"phone_number_id": "pnid-1"},
                            "messages": [
                                {
                                    "from": "+5491111111111",
                                    "id": "wamid-guard-1",
                                    "timestamp": "1710000000",
                                    "type": "text",
                                    "text": {"body": "quiero un turno"},
                                }
                            ],
                        }
                    }
                ]
            }
        ]
    }

    response = client.post("/webhook/whatsapp", json=payload, headers={"X-Hub-Signature-256": "sha256=dummy"})

    assert response.status_code == 200
    assert response.json() == {"status": "received"}
    assert len(queue.messages) == 1
    assert "clinical_decision" not in queue.messages[0]
    assert "triage_level" not in queue.messages[0]


def test_doctor_chat_contract_does_not_route_to_patient_triage() -> None:
    contract = build_contract(mode_raw="doctor_professional", actor_role_raw="doctor")

    decision, eligibility = RoleRouter.route(
        contract=contract,
        intent="symptom_report",
        confidence=0.99,
        context={"symptoms": ["dolor de pecho"]},
    )

    assert decision == RoutingDecision.DOCTOR_PIPELINE
    assert eligibility.is_triage_eligible is False


def test_receptionist_contract_has_no_clinical_history_or_triage_access() -> None:
    contract = build_contract(mode_raw="receptionist", actor_role_raw="receptionist")

    assert contract.capabilities.scheduling_allowed is True
    assert contract.capabilities.clinical_reasoning_allowed is False
    assert contract.capabilities.triage_allowed is False
    assert contract.capabilities.diagnosis_allowed is False


def test_deprecated_fastapi_whatsapp_webhook_is_blocked_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENABLE_PY_WHATSAPP_WEBHOOK_PROCESSING", raising=False)

    app = FastAPI()
    app.include_router(webhooks_whatsapp.router)
    client = TestClient(app)

    response = client.post("/webhooks/whatsapp", json={"entry": []})

    assert response.status_code == 410
    assert response.json()["detail"] == "deprecated_whatsapp_webhook_disabled"
