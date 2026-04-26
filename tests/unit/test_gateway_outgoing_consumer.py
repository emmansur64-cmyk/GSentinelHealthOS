from __future__ import annotations

import json

import pytest

from whatsapp_gateway.app.outgoing_consumer import WhatsAppOutgoingConsumer


class FakeRedis:
    def __init__(self) -> None:
        self.outgoing: list[str] = []
        self.closed = False

    async def execute_command(self, command: str, queue_name: str, timeout: int):
        assert command == "BRPOP"
        assert queue_name == "whatsapp:outgoing"
        if not self.outgoing:
            return None
        return queue_name, self.outgoing.pop(0)

    async def aclose(self) -> None:
        self.closed = True


class FakeWhatsAppService:
    def __init__(self) -> None:
        self.sent: list[tuple[str, str]] = []

    async def send_message(self, phone_number: str, message_text: str) -> bool:
        self.sent.append((phone_number, message_text))
        return True


@pytest.mark.asyncio
async def test_outgoing_consumer_processes_queue_message() -> None:
    redis = FakeRedis()
    redis.outgoing.append(json.dumps({"phone": "+34600000010", "text": "Hola desde Brain"}))
    service = FakeWhatsAppService()
    consumer = WhatsAppOutgoingConsumer(service, redis_client=redis)

    processed = await consumer.process_once(timeout=1)

    assert processed is True
    assert service.sent == [("+34600000010", "Hola desde Brain")]


@pytest.mark.asyncio
async def test_outgoing_consumer_ignores_invalid_payload() -> None:
    redis = FakeRedis()
    redis.outgoing.append("{invalid-json")
    service = FakeWhatsAppService()
    consumer = WhatsAppOutgoingConsumer(service, redis_client=redis)

    processed = await consumer.process_once(timeout=1)

    assert processed is False
    assert service.sent == []