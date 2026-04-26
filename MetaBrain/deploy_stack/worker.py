from __future__ import annotations

import asyncio
import json
import os
from time import time
from typing import Any

from redis.asyncio import Redis

from deploy_stack.logging_utils import bootstrap_logging, logger
from deploy_stack.settings import load_settings
from metabrain.pipeline import GroqLanguagePipeline

bootstrap_logging()
log = logger("deploy.worker")

WEBHOOK_QUEUE_KEY = "brain:queue:incoming"
RESULT_KEY_PREFIX = "brain:result:"
HEARTBEAT_KEY = "brain:worker:heartbeat"
PROCESSED_COUNTER_KEY = "brain:worker:processed_total"
RESULT_TTL_SECONDS = max(int(os.getenv("WORKER_RESULT_TTL_SECONDS", "3600") or "3600"), 60)


async def _heartbeat_loop(redis: Redis, ttl_seconds: int) -> None:
    while True:
        try:
            await redis.set(HEARTBEAT_KEY, int(time()), ex=ttl_seconds)
        except Exception as exc:
            log.error("worker.heartbeat.error", extra={"error": str(exc)})
        await asyncio.sleep(5)


def _build_response(message_id: str, text: str, result: Any) -> dict[str, Any]:
    output_text = ""
    stages: list[str] = []
    fallback = False
    quality = "unknown"

    if result is not None:
        output_text = str(getattr(result, "text", "") or "")
        stages = list(getattr(result, "stages_executed", []) or [])
        fallback = bool(getattr(result, "fallback_applied", False))
        orchestration = getattr(result, "orchestration", {}) or {}
        quality = str(orchestration.get("nivel_calidad", "unknown"))

    return {
        "status": "completed",
        "message_id": message_id,
        "input_text": text,
        "response_text": output_text,
        "pipeline": {
            "stages_executed": stages,
            "fallback_applied": fallback,
            "quality_level": quality,
        },
        "processed_at": int(time()),
    }


async def run_worker() -> None:
    settings = load_settings()
    redis = Redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
    pipeline = GroqLanguagePipeline()

    log.info(
        "worker.started",
        extra={
            "redis_url": settings.redis_url,
            "nlg_enabled": settings.nlg_groq_enabled,
            "model": settings.nlg_groq_model,
        },
    )

    heartbeat_task = asyncio.create_task(
        _heartbeat_loop(redis, settings.worker_heartbeat_ttl_seconds)
    )

    try:
        while True:
            item = await redis.blpop(WEBHOOK_QUEUE_KEY, timeout=5)
            if not item:
                continue

            _queue_name, raw_payload = item
            try:
                data = json.loads(raw_payload)
                message_id = str(data["message_id"])
                text = str(data.get("text") or "").strip()
                if not text:
                    raise ValueError("empty text")

                log.info(
                    "message.processing",
                    extra={"message_id": message_id, "text_size": len(text)},
                )

                result = pipeline.process(text, context={"source": "whatsapp"})
                payload = _build_response(message_id, text, result)

                await redis.set(
                    f"{RESULT_KEY_PREFIX}{message_id}",
                    json.dumps(payload, ensure_ascii=True),
                    ex=RESULT_TTL_SECONDS,
                )
                await redis.incr(PROCESSED_COUNTER_KEY)

                log.info(
                    "message.processed",
                    extra={
                        "message_id": message_id,
                        "fallback": payload["pipeline"]["fallback_applied"],
                        "quality": payload["pipeline"]["quality_level"],
                    },
                )
                log.info("response.sent", extra={"message_id": message_id})

            except Exception as exc:
                log.error("worker.processing.error", extra={"error": str(exc)}, exc_info=True)
    finally:
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except asyncio.CancelledError:
            pass
        await redis.aclose()
        log.info("worker.stopped")


if __name__ == "__main__":
    asyncio.run(run_worker())
