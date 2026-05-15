from __future__ import annotations

import logging
import os
import time
from asyncio import TimeoutError as AsyncTimeoutError
from asyncio import wait_for
from dataclasses import dataclass
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from redis.asyncio import Redis
from redis.exceptions import RedisError
from starlette.middleware.cors import CORSMiddleware

from cerebro_ai_med.api import security
from cerebro_ai_med.api.observability import (
    anonymize_text,
    configure_json_logging,
    metrics_payload,
    record_error_metric,
    record_http_metrics,
    record_inference_metrics,
)
from cerebro_ai_med.api.rate_limit import RedisRateLimiter, build_redis_rate_limiter
from cerebro_ai_med.api.runtime import RuntimeSettings, load_runtime_settings
from cerebro_ai_med.api.security import load_security_settings, require_api_key
from cerebro_ai_med.api.validators import decode_base64_image, parse_json_input, sanitize_text_input, validate_image_bytes
from cerebro_ai_med.memory import MemoryHistoryResponse, MemoryHistoryStore
from services.api_gateway.async_bus import AsyncAnalyzeBus, AsyncBusSettings
from services.api_gateway.clients import ServiceClient, ServiceClientSettings
from services.api_gateway.orchestrator import run_distributed_orchestration
from services.shared.contracts import AnalyzeResponse, AsyncAnalyzeAccepted, AsyncAnalyzePending, AsyncAnalyzeResult, ModelInput


configure_json_logging()
logger = logging.getLogger("cerebro_ai_med.distributed.gateway")

REDIS_CIRCUIT_FAILURES = max(int(os.getenv("CEREBRO_REDIS_CIRCUIT_FAILURES", "3") or "3"), 1)


@dataclass(frozen=True)
class GatewayServiceSettings:
    inference_url: str
    decision_url: str
    nlg_url: str
    service_timeout_seconds: float
    service_retries: int
    retry_backoff_seconds: float
    async_enabled: bool
    broker_url: str
    async_queue: str
    async_result_ttl_seconds: int
    memory_history_path: str


def _load_gateway_service_settings() -> GatewayServiceSettings:
    def _read_float(key: str, default: float, minimum: float) -> float:
        try:
            return max(float(os.getenv(key, str(default)).strip()), minimum)
        except Exception:
            return default

    def _read_int(key: str, default: int, minimum: int) -> int:
        try:
            return max(int(os.getenv(key, str(default)).strip()), minimum)
        except Exception:
            return default

    def _read_bool(key: str, default: bool) -> bool:
        raw = os.getenv(key, str(default)).strip().lower()
        if raw in {"1", "true", "yes", "on"}:
            return True
        if raw in {"0", "false", "no", "off"}:
            return False
        return default

    return GatewayServiceSettings(
        inference_url=os.getenv("INFERENCE_SERVICE_URL", "http://inference-service:8001").rstrip("/"),
        decision_url=os.getenv("DECISION_SERVICE_URL", "http://decision-service:8002").rstrip("/"),
        nlg_url=os.getenv("NLG_SERVICE_URL", "http://nlg-service:8003").rstrip("/"),
        service_timeout_seconds=_read_float("CEREBRO_INTERNAL_TIMEOUT_SECONDS", 4.0, 0.5),
        service_retries=_read_int("CEREBRO_INTERNAL_RETRIES", 2, 0),
        retry_backoff_seconds=_read_float("CEREBRO_INTERNAL_RETRY_BACKOFF_SECONDS", 0.25, 0.05),
        async_enabled=_read_bool("CEREBRO_ASYNC_ENABLED", False),
        broker_url=os.getenv("CEREBRO_BROKER_URL", "amqp://guest:guest@rabbitmq:5672/").strip(),
        async_queue=os.getenv("CEREBRO_ASYNC_QUEUE", "cerebro.analyze.requests").strip(),
        async_result_ttl_seconds=_read_int("CEREBRO_ASYNC_RESULT_TTL_SECONDS", 600, 60),
        memory_history_path=os.getenv("CEREBRO_MEMORY_HISTORY_PATH", "/tmp/cerebro_memory_history.jsonl").strip(),
    )


def _error_response(
    request: Request,
    *,
    status_code: int,
    category: str,
    code: str,
    message: str,
) -> JSONResponse:
    record_error_metric(category=category, code=code)
    request_id = getattr(request.state, "request_id", "unknown")
    payload = {
        "request_id": request_id,
        "error": {"category": category, "code": code, "message": message},
        "detail": code,
    }
    return JSONResponse(status_code=status_code, content=payload)


runtime_settings: RuntimeSettings = load_runtime_settings()
service_settings: GatewayServiceSettings = _load_gateway_service_settings()

app = FastAPI(title="api-gateway", version="1.0.0")
app.state.runtime_settings = runtime_settings
app.state.service_settings = service_settings
app.state.rate_limiter = None
app.state.async_result_store = None
app.state.redis_monitor = {
    "connected_once": False,
    "circuit_open": False,
    "consecutive_failures": 0,
    "last_error": None,
}
app.state.memory_store = MemoryHistoryStore(file_path=service_settings.memory_history_path)
app.state.service_client = ServiceClient(
    ServiceClientSettings(
        inference_url=service_settings.inference_url,
        decision_url=service_settings.decision_url,
        nlg_url=service_settings.nlg_url,
        timeout_seconds=service_settings.service_timeout_seconds,
        retries=service_settings.service_retries,
        retry_backoff_seconds=service_settings.retry_backoff_seconds,
    )
)
app.state.async_bus = AsyncAnalyzeBus(
    AsyncBusSettings(
        enabled=service_settings.async_enabled,
        broker_url=service_settings.broker_url,
        queue_name=service_settings.async_queue,
    )
)


def _emit_redis_failure_signal(target_app: FastAPI, error: Exception, source: str) -> None:
    monitor = target_app.state.redis_monitor
    monitor["consecutive_failures"] += 1
    monitor["last_error"] = str(error)

    logger.error(
        "redis.connection.error",
        extra={
            "source": source,
            "error": str(error),
            "consecutive_failures": monitor["consecutive_failures"],
        },
    )

    if monitor["consecutive_failures"] >= REDIS_CIRCUIT_FAILURES and not monitor["circuit_open"]:
        monitor["circuit_open"] = True
        logger.warning(
            "redis.circuit.open",
            extra={
                "source": source,
                "consecutive_failures": monitor["consecutive_failures"],
                "failure_threshold": REDIS_CIRCUIT_FAILURES,
            },
        )


def _emit_redis_recovered_signal(target_app: FastAPI, source: str) -> None:
    monitor = target_app.state.redis_monitor
    was_circuit_open = bool(monitor["circuit_open"])
    had_failures = int(monitor["consecutive_failures"]) > 0

    monitor["connected_once"] = True
    monitor["circuit_open"] = False
    monitor["consecutive_failures"] = 0
    monitor["last_error"] = None

    if was_circuit_open:
        logger.info("redis.recovered", extra={"source": source})
    elif had_failures:
        logger.info("redis.connected", extra={"source": source})


async def _check_redis_health(target_app: FastAPI, source: str) -> bool:
    limiter: RedisRateLimiter | None = getattr(target_app.state, "rate_limiter", None)
    if limiter is None:
        _emit_redis_failure_signal(target_app, RuntimeError("rate_limiter_uninitialized"), source)
        return False

    try:
        ok = await limiter.ping()
        if ok:
            _emit_redis_recovered_signal(target_app, source)
            return True
        _emit_redis_failure_signal(target_app, RuntimeError("ping_returned_false"), source)
        return False
    except Exception as exc:
        _emit_redis_failure_signal(target_app, exc, source)
        return False


def _save_to_memory_history(request: Request, model_input: ModelInput, result: AnalyzeResponse, source: str) -> None:
    memory_store: MemoryHistoryStore = request.app.state.memory_store

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
        request_id=getattr(request.state, "request_id", "unknown"),
        source=source,
        input_summary=input_summary,
        model_output=result.model_output.model_dump(mode="json"),
        decision_output=result.decision_output.model_dump(mode="json"),
        nlg_output=result.nlg_output.model_dump(mode="json"),
        fallback_used=result.fallback_used,
    )


def _merge_full_history_into_context(request: Request, patient_context: dict[str, object]) -> dict[str, object]:
    memory_store: MemoryHistoryStore = request.app.state.memory_store

    prior_items = memory_store.recent(limit=120).items
    memory_history: list[dict[str, object]] = []
    for entry in prior_items:
        nlg_text = str(entry.nlg_output.get("text", "")).strip()
        if not nlg_text:
            continue
        memory_history.append(
            {
                "role": "assistant",
                "text": nlg_text,
                "risk_level": entry.decision_output.get("risk_level"),
                "ts": entry.created_at_utc.isoformat(),
            }
        )

    existing_history = patient_context.get("conversation_history")
    user_history: list[dict[str, object]] = []
    if isinstance(existing_history, list):
        for item in existing_history:
            if isinstance(item, dict):
                user_history.append(item)

    merged_history = (memory_history + user_history)[-200:]

    enriched = dict(patient_context)
    if merged_history:
        enriched["conversation_history"] = merged_history
        enriched["history_size"] = len(merged_history)
        enriched["turn_index"] = len(merged_history) + 1

    return enriched


@app.on_event("startup")
async def _startup() -> None:
    runtime: RuntimeSettings = app.state.runtime_settings
    security.clear_security_settings_cache()
    app.state.security_settings = load_security_settings()
    app.state.rate_limiter = None

    if runtime.rate_limit_enabled:
        try:
            app.state.rate_limiter = await build_redis_rate_limiter(
                redis_url=runtime.rate_limit_redis_url,
                requests=runtime.rate_limit_requests,
                window_seconds=runtime.rate_limit_window_seconds,
            )
            await _check_redis_health(app, source="startup")
        except Exception as exc:
            _emit_redis_failure_signal(app, exc, source="startup")
            if not runtime.rate_limit_fail_open:
                raise RuntimeError(f"rate_limiter_startup_failed: {exc}") from exc
            logger.error("rate_limiter_disabled_due_to_redis_error", exc_info=True)

    try:
        app.state.async_result_store = Redis.from_url(
            runtime.rate_limit_redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    except Exception:
        app.state.async_result_store = None


@app.on_event("shutdown")
async def _shutdown() -> None:
    limiter: RedisRateLimiter | None = getattr(app.state, "rate_limiter", None)
    if limiter is not None:
        await limiter.close()

    result_store: Redis | None = getattr(app.state, "async_result_store", None)
    if result_store is not None:
        await result_store.aclose()


security_settings = load_security_settings()
if runtime_settings.app_env == "production" and "*" in security_settings.cors_allow_origins:
    raise RuntimeError("invalid_cors_configuration_for_production")

app.add_middleware(
    CORSMiddleware,
    allow_origins=security_settings.cors_allow_origins,
    allow_credentials=security_settings.cors_allow_credentials,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    request.state.request_id = request_id
    started = time.perf_counter()
    runtime: RuntimeSettings = request.app.state.runtime_settings

    content_length_raw = request.headers.get("content-length")
    if content_length_raw:
        try:
            content_length = int(content_length_raw)
        except ValueError:
            content_length = 0
        if content_length > runtime.max_request_body_bytes:
            return _error_response(
                request,
                status_code=413,
                category="validation",
                code="payload_too_large",
                message="Request body exceeds allowed size.",
            )

    if request.url.path.startswith("/analyze"):
        limiter: RedisRateLimiter | None = getattr(request.app.state, "rate_limiter", None)
        if runtime.rate_limit_enabled:
            if limiter is None and not runtime.rate_limit_fail_open:
                return _error_response(
                    request,
                    status_code=503,
                    category="system",
                    code="rate_limiter_unavailable",
                    message="Rate limiter backend is unavailable.",
                )
            if limiter is not None:
                client = request.client.host if request.client else "unknown"
                identity = f"{client}:{request.url.path}"
                try:
                    decision = await limiter.evaluate(identity=identity)
                    _emit_redis_recovered_signal(request.app, source="request_rate_limiter")
                except RedisError as exc:
                    _emit_redis_failure_signal(request.app, exc, source="request_rate_limiter")
                    if not runtime.rate_limit_fail_open:
                        return _error_response(
                            request,
                            status_code=503,
                            category="system",
                            code="rate_limiter_backend_error",
                            message="Rate limiter backend failed.",
                        )
                    decision = None

                if decision is not None and not decision.allowed:
                    response = _error_response(
                        request,
                        status_code=429,
                        category="validation",
                        code="rate_limit_exceeded",
                        message="Too many requests for this window.",
                    )
                    response.headers["X-RateLimit-Limit"] = str(decision.limit)
                    response.headers["X-RateLimit-Remaining"] = str(decision.remaining)
                    response.headers["X-RateLimit-Reset"] = str(decision.reset_seconds)
                    return response

    try:
        response = await wait_for(call_next(request), timeout=runtime.request_timeout_seconds)
    except AsyncTimeoutError:
        return _error_response(
            request,
            status_code=504,
            category="system",
            code="request_timeout",
            message="Request processing exceeded timeout.",
        )

    elapsed_ms = (time.perf_counter() - started) * 1000.0
    elapsed_seconds = elapsed_ms / 1000.0

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-XSS-Protection"] = "0"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none';"
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time-ms"] = f"{elapsed_ms:.2f}"

    record_http_metrics(request.method, request.url.path, response.status_code, elapsed_seconds)
    return response


@app.post("/analyze", response_model=AnalyzeResponse, dependencies=[Depends(require_api_key)])
async def analyze(request: Request) -> AnalyzeResponse:
    service_client: ServiceClient = request.app.state.service_client

    body = await request.json()
    parsed = parse_json_input(body)

    if parsed.input_type == "text":
        text_clean = sanitize_text_input(parsed.text)
        model_input = ModelInput(
            source_type="text",
            modality=parsed.modality,
            text=text_clean,
        )
        patient_context = body.get("patient_context") or {}
        logger.info(
            "gateway_text_input",
            extra={
                "request_id": request.state.request_id,
                "summary": anonymize_text(text_clean),
            },
        )
    else:
        image_bytes = decode_base64_image(parsed.image_base64)
        image_meta = validate_image_bytes(image_bytes)
        model_input = ModelInput(
            source_type="image",
            modality=parsed.modality,
            image_bytes=len(image_bytes),
            image_width=image_meta.width,
            image_height=image_meta.height,
            image_format=image_meta.image_format,
        )
        patient_context = body.get("patient_context") or {}

    patient_context = _merge_full_history_into_context(request, patient_context)

    result = await run_distributed_orchestration(
        service_client=service_client,
        model_input=model_input,
        patient_context=patient_context,
    )

    record_inference_metrics(
        source_type=model_input.source_type,
        model_version=result.model_output.model_version,
        risk_level=result.model_output.risk_level,
        elapsed_seconds=0.0,
    )

    _save_to_memory_history(
        request=request,
        model_input=model_input,
        result=result,
        source="sync",
    )

    return result


@app.post("/analyze/async", response_model=AsyncAnalyzeAccepted, dependencies=[Depends(require_api_key)])
async def analyze_async(request: Request) -> AsyncAnalyzeAccepted:
    settings: GatewayServiceSettings = request.app.state.service_settings
    async_bus: AsyncAnalyzeBus = request.app.state.async_bus

    if not settings.async_enabled or not async_bus.enabled:
        raise HTTPException(status_code=503, detail="async_mode_disabled")

    body = await request.json()
    parsed = parse_json_input(body)

    if parsed.input_type == "text":
        text_clean = sanitize_text_input(parsed.text)
        model_input = ModelInput(source_type="text", modality=parsed.modality, text=text_clean)
        patient_context = body.get("patient_context") or {}
    else:
        image_bytes = decode_base64_image(parsed.image_base64)
        image_meta = validate_image_bytes(image_bytes)
        model_input = ModelInput(
            source_type="image",
            modality=parsed.modality,
            image_bytes=len(image_bytes),
            image_width=image_meta.width,
            image_height=image_meta.height,
            image_format=image_meta.image_format,
        )
        patient_context = body.get("patient_context") or {}

    patient_context = _merge_full_history_into_context(request, patient_context)

    job_id = str(uuid4())
    await async_bus.publish(
        {
            "job_id": job_id,
            "model_input": model_input.model_dump(),
            "patient_context": patient_context,
        }
    )

    return AsyncAnalyzeAccepted(
        status="accepted",
        mode="async_queue",
        job_id=job_id,
        poll_url=f"/analyze/result/{job_id}",
    )


@app.get("/analyze/result/{job_id}", response_model=AsyncAnalyzePending | AsyncAnalyzeResult, dependencies=[Depends(require_api_key)])
async def analyze_result(request: Request, job_id: str) -> AsyncAnalyzePending | AsyncAnalyzeResult:
    result_store: Redis | None = request.app.state.async_result_store
    if result_store is None:
        raise HTTPException(status_code=503, detail="async_result_store_unavailable")

    key = f"cerebro:async:result:{job_id}"
    raw = await result_store.get(key)
    if not raw:
        return AsyncAnalyzePending(status="pending", mode="async_queue", job_id=job_id)

    result = AnalyzeResponse.model_validate_json(raw)
    return AsyncAnalyzeResult(
        status="completed",
        mode="async_queue",
        job_id=job_id,
        result=result,
    )


@app.get("/memory/history", response_model=MemoryHistoryResponse, dependencies=[Depends(require_api_key)])
def memory_history(request: Request, limit: int = 20) -> MemoryHistoryResponse:
    memory_store: MemoryHistoryStore = request.app.state.memory_store
    return memory_store.recent(limit=limit)


@app.get("/health/live")
def health_live() -> dict[str, str]:
    return {"status": "ok", "service": "api-gateway", "version": "1.0.0"}


@app.get("/health/ready")
async def health_ready(request: Request) -> JSONResponse:
    client: ServiceClient = request.app.state.service_client
    settings: GatewayServiceSettings = request.app.state.service_settings
    runtime: RuntimeSettings = request.app.state.runtime_settings

    redis_ok = True
    if runtime.rate_limit_enabled:
        redis_ok = await _check_redis_health(request.app, source="health_ready")

    checks = {
        "inference_service": await client.ping(settings.inference_url),
        "decision_service": await client.ping(settings.decision_url),
        "nlg_service": await client.ping(settings.nlg_url),
        "api_key_configured": bool(load_security_settings().api_key),
        "async_broker_enabled": settings.async_enabled,
        "redis_connected": redis_ok,
        "redis_circuit_open": bool(request.app.state.redis_monitor["circuit_open"]),
        "redis_last_error": request.app.state.redis_monitor["last_error"],
    }

    ready = all(checks.values())
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ready" if ready else "degraded",
            "service": "api-gateway",
            "checks": checks,
        },
    )


@app.get("/metrics")
def metrics() -> Response:
    payload, content_type = metrics_payload()
    return Response(content=payload, media_type=content_type)
