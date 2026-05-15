from __future__ import annotations

import asyncio
import json
import logging
import os

from redis.asyncio import Redis

from cerebro_ai_med.memory import MemoryHistoryStore
from services.api_gateway.async_bus import AsyncBusSettings
from services.api_gateway.clients import ServiceClient, ServiceClientSettings
from services.api_gateway.orchestrator import run_distributed_orchestration
from services.shared.contracts import ModelInput


logger = logging.getLogger("cerebro_ai_med.distributed.worker")


def _load_bus_settings() -> AsyncBusSettings:
    enabled_raw = os.getenv("CEREBRO_ASYNC_ENABLED", "false").strip().lower()
    enabled = enabled_raw in {"1", "true", "yes", "on"}
    return AsyncBusSettings(
        enabled=enabled,
        broker_url=os.getenv("CEREBRO_BROKER_URL", "amqp://guest:guest@rabbitmq:5672/").strip(),
        queue_name=os.getenv("CEREBRO_ASYNC_QUEUE", "cerebro.analyze.requests").strip(),
    )


def _load_client_settings() -> ServiceClientSettings:
    return ServiceClientSettings(
        inference_url=os.getenv("INFERENCE_SERVICE_URL", "http://inference-service:8001").rstrip("/"),
        decision_url=os.getenv("DECISION_SERVICE_URL", "http://decision-service:8002").rstrip("/"),
        nlg_url=os.getenv("NLG_SERVICE_URL", "http://nlg-service:8003").rstrip("/"),
        timeout_seconds=float(os.getenv("CEREBRO_INTERNAL_TIMEOUT_SECONDS", "4").strip()),
        retries=int(os.getenv("CEREBRO_INTERNAL_RETRIES", "2").strip()),
        retry_backoff_seconds=float(os.getenv("CEREBRO_INTERNAL_RETRY_BACKOFF_SECONDS", "0.25").strip()),
    )


async def _process_message(
    body: bytes,
    redis: Redis,
    service_client: ServiceClient,
    ttl_seconds: int,
    memory_store: MemoryHistoryStore,
) -> None:
    data = json.loads(body.decode("utf-8"))
    job_id = str(data["job_id"])
    model_input = ModelInput.model_validate(data["model_input"])
    patient_context = data.get("patient_context") or {}

    result = await run_distributed_orchestration(
        service_client=service_client,
        model_input=model_input,
        patient_context=patient_context,
    )

    key = f"cerebro:async:result:{job_id}"
    await redis.set(key, result.model_dump_json(), ex=ttl_seconds)

    input_summary: dict[str, object] = {
        "source_type": model_input.source_type,
        "modality": model_input.modality,
    }
    if model_input.text:
        input_summary["text_length"] = len(model_input.text)
    if model_input.image_width and model_input.image_height:
        input_summary["image_width"] = model_input.image_width
        input_summary["image_height"] = model_input.image_height
        input_summary["image_format"] = model_input.image_format

    memory_store.append(
        request_id=job_id,
        source="async",
        input_summary=input_summary,
        model_output=result.model_output.model_dump(mode="json"),
        decision_output=result.decision_output.model_dump(mode="json"),
        nlg_output=result.nlg_output.model_dump(mode="json"),
        fallback_used=result.fallback_used,
    )


async def run_worker() -> None:
    bus_settings = _load_bus_settings()
    if not bus_settings.enabled:
        raise RuntimeError("CEREBRO_ASYNC_ENABLED must be true for worker")

    client_settings = _load_client_settings()
    service_client = ServiceClient(client_settings)

    result_ttl_seconds = int(os.getenv("CEREBRO_ASYNC_RESULT_TTL_SECONDS", "600").strip())
    redis_url = os.getenv("CEREBRO_REDIS_URL", "redis://redis:6379/0").strip()
    redis = Redis.from_url(redis_url, encoding="utf-8", decode_responses=True)
    memory_history_path = os.getenv("CEREBRO_MEMORY_HISTORY_PATH", "/tmp/cerebro_memory_history.jsonl").strip()
    memory_store = MemoryHistoryStore(file_path=memory_history_path)

    import aio_pika

    connection = await aio_pika.connect_robust(bus_settings.broker_url)
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=4)
    queue = await channel.declare_queue(bus_settings.queue_name, durable=True)

    logger.info("async_worker_started")

    async with queue.iterator() as iterator:
        async for message in iterator:
            async with message.process(requeue=False):
                try:
                    await _process_message(
                        body=message.body,
                        redis=redis,
                        service_client=service_client,
                        ttl_seconds=result_ttl_seconds,
                        memory_store=memory_store,
                    )
                except Exception as exc:
                    logger.exception("async_worker_message_failed", extra={"error": str(exc)})


if __name__ == "__main__":
    asyncio.run(run_worker())
