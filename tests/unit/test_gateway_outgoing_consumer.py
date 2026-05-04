from __future__ import annotations

import json

import pytest

from whatsapp_gateway.app.outgoing_consumer import WhatsAppOutgoingConsumer


class FakeRedis:
    def __init__(self) -> None:
        self.outgoing: list[str] = []
        self.dead: list[str] = []
        self.kv: dict[str, str] = {}
        self.counters: dict[str, int] = {}
        self.closed = False

    async def execute_command(self, command: str, queue_name: str, *args):
        if command == "BRPOP":
            assert queue_name == "whatsapp:outgoing"
            if not self.outgoing:
                return None
            return queue_name, self.outgoing.pop(0)

        if command == "RPUSH":
            payload = str(args[0])
            self.outgoing.append(payload)
            return len(self.outgoing)

        if command == "LPUSH":
            payload = str(args[0])
            if queue_name == "whatsapp:outgoing:dead":
                self.dead.append(payload)
                return len(self.dead)
            self.outgoing.insert(0, payload)
            return len(self.outgoing)

        raise AssertionError(f"Comando no soportado: {command}")

    async def get(self, key: str):
        return self.kv.get(key)

    async def set(self, key: str, value: str, ex: int | None = None, nx: bool = False):
        if nx and key in self.kv:
            return None
        self.kv[key] = value
        return True

    async def incr(self, key: str):
        current = int(self.counters.get(key, 0)) + 1
        self.counters[key] = current
        return current

    async def expire(self, key: str, seconds: int):
        return True

    async def llen(self, queue_name: str):
        if queue_name == "whatsapp:outgoing:dead":
            return len(self.dead)
        return len(self.outgoing)

    async def aclose(self) -> None:
        self.closed = True


class FakeWhatsAppService:
    def __init__(self) -> None:
        self.sent: list[tuple[str, str, str | None, str | None]] = []

    async def send_message(
        self,
        phone_number: str,
        message_text: str,
        *,
        access_token: str | None = None,
        phone_number_id: str | None = None,
    ) -> bool:
        self.sent.append((phone_number, message_text, access_token, phone_number_id))
        return True


class FakeAccountResolver:
    def __init__(self, account: dict[str, str] | None) -> None:
        self._account = account

    async def get_by_client_id(self, client_id: str):
        if self._account is None:
            return None

        class Row:
            def __init__(self, account: dict[str, str]) -> None:
                self.client_id = account["client_id"]
                self.phone_number_id = account["phone_number_id"]
                self.access_token = account["access_token"]

        if client_id != self._account["client_id"]:
            return None
        return Row(self._account)


@pytest.mark.asyncio
async def test_outgoing_consumer_processes_queue_message() -> None:
    redis = FakeRedis()
    redis.outgoing.append(json.dumps({"phone": "+34600000010", "text": "Hola desde Brain"}))
    service = FakeWhatsAppService()
    consumer = WhatsAppOutgoingConsumer(service, redis_client=redis)

    processed = await consumer.process_once(timeout=1)

    assert processed is True
    assert service.sent == [("+34600000010", "Hola desde Brain", None, None)]


@pytest.mark.asyncio
async def test_outgoing_consumer_ignores_invalid_payload() -> None:
    redis = FakeRedis()
    redis.outgoing.append("{invalid-json")
    service = FakeWhatsAppService()
    consumer = WhatsAppOutgoingConsumer(service, redis_client=redis)

    processed = await consumer.process_once(timeout=1)

    assert processed is False
    assert service.sent == []


@pytest.mark.asyncio
async def test_outgoing_consumer_uses_client_credentials_when_present() -> None:
    redis = FakeRedis()
    redis.outgoing.append(
        json.dumps(
            {
                "client_id": "client-a",
                "to": "+34600000011",
                "message": "Hola multi-tenant",
            }
        )
    )
    service = FakeWhatsAppService()
    resolver = FakeAccountResolver(
        {
            "client_id": "client-a",
            "phone_number_id": "pnid-123",
            "access_token": "token-abc",
        }
    )
    consumer = WhatsAppOutgoingConsumer(service, redis_client=redis, account_resolver=resolver)

    processed = await consumer.process_once(timeout=1)

    assert processed is True
    assert service.sent == [(
        "+34600000011",
        "Hola multi-tenant",
        "token-abc",
        "pnid-123",
    )]


@pytest.mark.asyncio
async def test_outgoing_consumer_sends_to_dlq_when_client_not_found() -> None:
    redis = FakeRedis()
    redis.outgoing.append(
        json.dumps(
            {
                "client_id": "unknown-client",
                "to": "+34600000012",
                "message": "Hola fallback",
            }
        )
    )
    service = FakeWhatsAppService()
    resolver = FakeAccountResolver(None)
    consumer = WhatsAppOutgoingConsumer(service, redis_client=redis, account_resolver=resolver)

    processed = await consumer.process_once(timeout=1)

    assert processed is True
    assert service.sent == []
    assert len(redis.dead) == 1
    dead_payload = json.loads(redis.dead[0])
    assert dead_payload["_dlq_reason"] == "account_not_found_for_tenant"
