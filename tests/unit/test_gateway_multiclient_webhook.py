from __future__ import annotations

from dataclasses import dataclass

from fastapi import FastAPI
from fastapi.testclient import TestClient

from whatsapp_gateway.api.routes import webhook


@dataclass
class FakeAccount:
    client_id: str
    clinic_id: str | None = None
    app_secret: str | None = None
    phone_number_id: str | None = None
    access_token: str | None = None


class FakeQueue:
    def __init__(self) -> None:
        self.messages: list[dict] = []

    async def publish(self, message: dict) -> bool:
        self.messages.append(message)
        return True

    async def close(self) -> None:
        return None


class FakeResolver:
    def __init__(self, account: FakeAccount | None) -> None:
        self.account = account
        self.last_phone_number_id: str | None = None

    async def get_by_phone_number_id(self, phone_number_id: str | None):
        self.last_phone_number_id = phone_number_id
        if self.account is None:
            return None
        return self.account

    async def get_by_verify_token(self, verify_token: str | None):
        return None

    async def close(self) -> None:
        return None


def _build_app() -> FastAPI:
    app = FastAPI()
    app.include_router(webhook.router)
    return app


def test_webhook_enqueues_incoming_with_client_id(monkeypatch) -> None:
    queue = FakeQueue()
    resolver = FakeResolver(
        FakeAccount(
            client_id="client-123",
            clinic_id="clinic-777",
            app_secret="app-secret",
            phone_number_id="pnid-777",
        )
    )

    monkeypatch.setattr(webhook, "queue_service", queue)
    monkeypatch.setattr(webhook, "account_resolver", resolver)
    monkeypatch.setattr(webhook.whatsapp_service, "verify_signature", lambda body, signature, app_secret=None: True)

    app = _build_app()
    client = TestClient(app)

    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "metadata": {"phone_number_id": "pnid-777"},
                            "messages": [
                                {
                                    "from": "+5491112345678",
                                    "id": "wamid-1",
                                    "timestamp": "1710000000",
                                    "type": "text",
                                    "text": {"body": "hola"},
                                }
                            ],
                        }
                    }
                ]
            }
        ]
    }

    response = client.post(
        "/webhook/whatsapp",
        json=payload,
        headers={"X-Hub-Signature-256": "sha256=dummy"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "received"}
    assert resolver.last_phone_number_id == "pnid-777"
    assert len(queue.messages) == 1
    queued = queue.messages[0]
    assert queued["tenant_id"] == "client-123"
    assert queued["client_id"] == "client-123"
    assert queued["clinic_id"] == "clinic-777"
    assert queued["phone_number_id"] == "pnid-777"
    assert queued["from"] == "+5491112345678"
    assert queued["text"] == "hola"
    assert isinstance(queued["raw"], dict)


def test_webhook_rejects_when_account_not_found(monkeypatch) -> None:
    queue = FakeQueue()
    resolver = FakeResolver(None)

    monkeypatch.setattr(webhook, "queue_service", queue)
    monkeypatch.setattr(webhook, "account_resolver", resolver)
    monkeypatch.setattr(webhook.whatsapp_service, "verify_signature", lambda body, signature, app_secret=None: True)

    app = _build_app()
    client = TestClient(app)

    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "metadata": {"phone_number_id": "pnid-legacy"},
                            "messages": [
                                {
                                    "from": "+5491199999999",
                                    "id": "wamid-2",
                                    "timestamp": "1710000001",
                                    "type": "text",
                                    "text": {"body": "hola legacy"},
                                }
                            ],
                        }
                    }
                ]
            }
        ]
    }

    response = client.post(
        "/webhook/whatsapp",
        json=payload,
        headers={"X-Hub-Signature-256": "sha256=dummy"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "ignored"}
    assert len(queue.messages) == 0


def test_webhook_allows_tenant_only_when_clinic_missing(monkeypatch) -> None:
    queue = FakeQueue()
    resolver = FakeResolver(
        FakeAccount(
            client_id="client-tenant-only",
            clinic_id=None,
            app_secret="app-secret",
            phone_number_id="pnid-tenant-only",
        )
    )

    monkeypatch.setattr(webhook, "queue_service", queue)
    monkeypatch.setattr(webhook, "account_resolver", resolver)
    monkeypatch.setattr(webhook.whatsapp_service, "verify_signature", lambda body, signature, app_secret=None: True)

    app = _build_app()
    client = TestClient(app)

    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "metadata": {"phone_number_id": "pnid-tenant-only"},
                            "messages": [
                                {
                                    "from": "+549115551111",
                                    "id": "wamid-tenant-only",
                                    "timestamp": "1710000002",
                                    "type": "text",
                                    "text": {"body": "hola tenant only"},
                                }
                            ],
                        }
                    }
                ]
            }
        ]
    }

    response = client.post(
        "/webhook/whatsapp",
        json=payload,
        headers={"X-Hub-Signature-256": "sha256=dummy"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "received"}
    assert len(queue.messages) == 1
    assert queue.messages[0]["tenant_id"] == "client-tenant-only"
    assert queue.messages[0]["client_id"] == "client-tenant-only"
    assert queue.messages[0]["clinic_id"] is None
    assert queue.messages[0]["phone_number_id"] == "pnid-tenant-only"
