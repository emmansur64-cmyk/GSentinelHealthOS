from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import os
from time import perf_counter, time
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from groq import Groq
from redis.asyncio import Redis

from deploy_stack.logging_utils import bootstrap_logging, logger
from deploy_stack.settings import DeploySettings, load_settings

bootstrap_logging()
log = logger("deploy.gateway")

WORKER_HEARTBEAT_KEY = "brain:worker:heartbeat"
WEBHOOK_QUEUE_KEY = "brain:queue:incoming"
RESULT_KEY_PREFIX = "brain:result:"

app = FastAPI(title="metabrain-gateway", version="1.0.0")


def _status_payload(status: str, latency_ms: float, detail: dict[str, Any]) -> JSONResponse:
    status_code = 200 if status == "healthy" else 503 if status == "down" else 207
    return JSONResponse(
        status_code=status_code,
        content={"status": status, "latency_ms": round(latency_ms, 2), "detail": detail},
    )


def _verify_signature(raw_body: bytes, signature: str | None, app_secret: str) -> bool:
    if not signature:
        return False
    if not signature.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    sent = signature.replace("sha256=", "", 1)
    return hmac.compare_digest(expected, sent)


def _extract_message(payload: dict[str, Any]) -> tuple[str, str]:
    entries = payload.get("entry")
    if not isinstance(entries, list) or not entries:
        raise ValueError("missing entry")

    changes = entries[0].get("changes")
    if not isinstance(changes, list) or not changes:
        raise ValueError("missing changes")

    value = changes[0].get("value") or {}
    messages = value.get("messages")
    if not isinstance(messages, list) or not messages:
        raise ValueError("missing messages")

    msg = messages[0]
    message_id = str(msg.get("id") or uuid4())
    text = ((msg.get("text") or {}).get("body") or "").strip()
    if not text:
        raise ValueError("missing text.body")
    return message_id, text


async def _groq_probe(settings: DeploySettings) -> tuple[str, float, str | None]:
    t0 = perf_counter()
    try:
        if not settings.nlg_groq_enabled:
            return "degraded", (perf_counter() - t0) * 1000, "NLG_GROQ_ENABLED=false"

        client = Groq(api_key=settings.groq_api_key)
        completion = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: client.chat.completions.create(
                model=settings.nlg_groq_model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1,
                temperature=0.0,
            ),
        )
        latency_ms = (perf_counter() - t0) * 1000
        content = ""
        if completion.choices and completion.choices[0].message:
            content = completion.choices[0].message.content or ""
        if not content.strip():
            return "degraded", latency_ms, "empty response"
        return "healthy", latency_ms, None
    except Exception as exc:
        return "down", (perf_counter() - t0) * 1000, str(exc)


@app.on_event("startup")
async def _startup() -> None:
    settings = load_settings()
    app.state.settings = settings
    app.state.redis = Redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
    app.state.started_at = int(time())
    log.info(
        "gateway.started",
        extra={
            "port": settings.gateway_port,
            "redis_url": settings.redis_url,
            "model": settings.nlg_groq_model,
        },
    )


@app.on_event("shutdown")
async def _shutdown() -> None:
    redis: Redis | None = getattr(app.state, "redis", None)
    if redis is not None:
        await redis.aclose()
    log.info("gateway.stopped")


@app.get("/webhook/whatsapp")
async def verify_webhook(
    hub_mode: str = Query("", alias="hub.mode"),
    hub_challenge: str = Query("", alias="hub.challenge"),
    hub_verify_token: str = Query("", alias="hub.verify_token"),
) -> PlainTextResponse:
    settings: DeploySettings = app.state.settings
    if hub_mode == "subscribe" and hub_verify_token == settings.whatsapp_verify_token:
        return PlainTextResponse(content=hub_challenge, status_code=200)
    raise HTTPException(status_code=403, detail="verification_failed")


@app.post("/webhook/whatsapp")
async def receive_webhook(
    request: Request,
    x_hub_signature_256: str | None = Header(default=None, alias="X-Hub-Signature-256"),
) -> JSONResponse:
    settings: DeploySettings = app.state.settings
    redis: Redis = app.state.redis

    raw = await request.body()
    if not _verify_signature(raw, x_hub_signature_256, settings.whatsapp_app_secret):
        log.warning("webhook.invalid_signature")
        raise HTTPException(status_code=401, detail="invalid_signature")

    try:
        payload = json.loads(raw.decode("utf-8"))
        message_id, text = _extract_message(payload)
    except Exception as exc:
        log.error("webhook.invalid_payload", extra={"error": str(exc)})
        raise HTTPException(status_code=400, detail=f"invalid_payload: {exc}") from exc

    item = {
        "message_id": message_id,
        "text": text,
        "received_at": int(time()),
        "source": "whatsapp",
    }
    await redis.rpush(WEBHOOK_QUEUE_KEY, json.dumps(item, ensure_ascii=True))

    log.info(
        "webhook.received",
        extra={"message_id": message_id, "text_size": len(text)},
    )
    log.info("message.enqueued", extra={"queue": WEBHOOK_QUEUE_KEY, "message_id": message_id})

    return JSONResponse(status_code=202, content={"status": "accepted", "message_id": message_id})


@app.get("/result/{message_id}")
async def get_result(message_id: str) -> JSONResponse:
    redis: Redis = app.state.redis
    raw = await redis.get(f"{RESULT_KEY_PREFIX}{message_id}")
    if not raw:
        return JSONResponse(status_code=202, content={"status": "pending", "message_id": message_id})
    return JSONResponse(status_code=200, content=json.loads(raw))


@app.get("/health/redis")
async def health_redis() -> JSONResponse:
    redis: Redis = app.state.redis
    t0 = perf_counter()
    try:
        ok = await redis.ping()
        latency_ms = (perf_counter() - t0) * 1000
        status = "healthy" if ok else "down"
        return _status_payload(status, latency_ms, {"redis_connected": bool(ok)})
    except Exception as exc:
        return _status_payload("down", (perf_counter() - t0) * 1000, {"error": str(exc)})


@app.get("/health/groq")
async def health_groq() -> JSONResponse:
    settings: DeploySettings = app.state.settings
    status, latency_ms, reason = await _groq_probe(settings)
    detail: dict[str, Any] = {"model": settings.nlg_groq_model}
    if reason:
        detail["reason"] = reason
    return _status_payload(status, latency_ms, detail)


@app.get("/health")
async def health() -> JSONResponse:
    redis: Redis = app.state.redis
    settings: DeploySettings = app.state.settings
    t0 = perf_counter()

    redis_status = "down"
    worker_status = "down"
    groq_status = "down"

    try:
        if await redis.ping():
            redis_status = "healthy"

        hb = await redis.get(WORKER_HEARTBEAT_KEY)
        if hb:
            elapsed = int(time()) - int(hb)
            worker_status = "healthy" if elapsed <= settings.worker_heartbeat_ttl_seconds else "degraded"

    except Exception:
        redis_status = "down"

    groq_status, _, _ = await _groq_probe(settings)

    statuses = [redis_status, worker_status, groq_status]
    overall = "healthy"
    if "down" in statuses:
        overall = "down"
    elif "degraded" in statuses:
        overall = "degraded"

    return _status_payload(
        overall,
        (perf_counter() - t0) * 1000,
        {
            "redis": redis_status,
            "worker": worker_status,
            "groq": groq_status,
        },
    )


@app.get("/metrics")
async def metrics() -> JSONResponse:
    redis: Redis = app.state.redis
    queue_length = 0
    processed_total = 0
    try:
        queue_length = int(await redis.llen(WEBHOOK_QUEUE_KEY))
        processed_total = int(await redis.get("brain:worker:processed_total") or 0)
    except Exception:
        pass

    return JSONResponse(
        status_code=200,
        content={
            "requests_total": processed_total + queue_length,
            "errors_total": int(os.getenv("DEPLOY_ERRORS_TOTAL", "0") or "0"),
            "queue_length": queue_length,
            "processed_total": processed_total,
            "system_status": "ok",
        },
    )
