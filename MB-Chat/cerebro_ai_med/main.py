import json
import logging
import os
import time
from asyncio import TimeoutError as AsyncTimeoutError
from asyncio import wait_for
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.responses import Response
from redis.asyncio import Redis
from redis.exceptions import RedisError
from starlette.middleware.cors import CORSMiddleware

from cerebro_ai_med.api import security
from cerebro_ai_med.api.observability import configure_json_logging, metrics_payload, record_error_metric, record_http_metrics
from cerebro_ai_med.api.rate_limit import RedisRateLimiter, build_redis_rate_limiter
from cerebro_ai_med.api.routes import router as api_router
from cerebro_ai_med.api.schemas import ErrorResponse, HealthResponse
from cerebro_ai_med.api.security import load_security_settings
from cerebro_ai_med.api.runtime import RuntimeSettings, load_runtime_settings
from cerebro_ai_med.models import get_model_service
from cerebro_ai_med.models.ml_model import REGISTRY_PATH
from cerebro_ai_med.models.registry import compute_sha256, parse_active_spec


configure_json_logging()
logger = logging.getLogger("cerebro_ai_med.api")

REDIS_CIRCUIT_FAILURES = max(int(os.getenv("CEREBRO_REDIS_CIRCUIT_FAILURES", "3") or "3"), 1)


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
    payload = ErrorResponse(
        request_id=request_id,
        error={"category": category, "code": code, "message": message},
        detail=code,
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump())


runtime_settings: RuntimeSettings = load_runtime_settings()
app = FastAPI(title="Cerebro AI Med", version=runtime_settings.api_version)
app.state.runtime_settings = runtime_settings
app.state.rate_limiter = None
app.state.async_result_store = None
app.state.redis_monitor = {
    "connected_once": False,
    "circuit_open": False,
    "consecutive_failures": 0,
    "last_error": None,
}


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

                if decision is not None:
                    if not decision.allowed:
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
    except Exception:
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        logger.error(
            "request_failed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "duration_ms": round(elapsed_ms, 4),
            },
            exc_info=True,
        )
        raise

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
    logger.info(
        "request_completed",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": round(elapsed_ms, 4),
        },
    )

    return response

app.include_router(api_router)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="cerebro_ai_med", version=runtime_settings.api_version)


@app.get("/health/live")
def health_live() -> dict[str, str]:
    return {"status": "ok", "service": "cerebro_ai_med", "version": runtime_settings.api_version}


@app.get("/metrics")
def metrics() -> Response:
    payload, content_type = metrics_payload()
    return Response(content=payload, media_type=content_type)


@app.get("/health/ready")
async def health_ready() -> JSONResponse:
    runtime: RuntimeSettings = app.state.runtime_settings
    model_health = _build_model_health()
    redis_ok = True

    if runtime.rate_limit_enabled:
        redis_ok = await _check_redis_health(app, source="health_ready")

    checks: dict[str, object] = {
        "api_key_configured": False,
        "model_registry_exists": REGISTRY_PATH.exists(),
        "active_model_valid": bool(model_health["checks"]["active_model_resolved"]),
        "model_service_loaded": bool(model_health["checks"]["model_service_loaded"]),
        "model_version": model_health["active_model_version"],
        "integrity_ok": bool(model_health["checks"]["artifact_integrity_ok"]),
        "redis_connected": redis_ok,
        "redis_circuit_open": bool(app.state.redis_monitor["circuit_open"]),
        "redis_last_error": app.state.redis_monitor["last_error"],
    }

    try:
        settings = load_security_settings()
        checks["api_key_configured"] = bool(settings.api_key)
    except Exception:
        checks["api_key_configured"] = False

    ready = all(
        bool(checks[key])
        for key in (
            "api_key_configured",
            "model_registry_exists",
            "active_model_valid",
            "model_service_loaded",
            "integrity_ok",
            "redis_connected",
        )
    )

    payload = {
        "status": "ready" if ready else "degraded",
        "service": "cerebro_ai_med",
        "version": runtime_settings.api_version,
        "checks": checks,
        "model_health": model_health,
    }
    return JSONResponse(status_code=200 if ready else 503, content=payload)


def _build_model_health() -> dict[str, object]:
    checks: dict[str, object] = {
        "registry_exists": REGISTRY_PATH.exists(),
        "registry_parse_ok": False,
        "active_model_resolved": False,
        "text_artifact_exists": False,
        "image_artifact_exists": False,
        "text_checksum_match": False,
        "image_checksum_match": False,
        "artifact_integrity_ok": False,
        "model_service_loaded": False,
    }

    active_version = "unknown"
    details: dict[str, object] = {
        "registry_path": str(REGISTRY_PATH),
    }

    try:
        raw = json.loads(Path(REGISTRY_PATH).read_text(encoding="utf-8"))
        checks["registry_parse_ok"] = True
        active_version = str(raw.get("active_model", "unknown"))
    except Exception:
        checks["registry_parse_ok"] = False

    try:
        spec = parse_active_spec(REGISTRY_PATH)
        active_version = spec.version
        checks["active_model_resolved"] = True

        checks["text_artifact_exists"] = spec.text_artifact.path.exists()
        checks["image_artifact_exists"] = spec.image_artifact.path.exists()

        text_sha = compute_sha256(spec.text_artifact.path)
        image_sha = compute_sha256(spec.image_artifact.path)

        checks["text_checksum_match"] = text_sha == spec.text_artifact.sha256
        checks["image_checksum_match"] = image_sha == spec.image_artifact.sha256
        checks["artifact_integrity_ok"] = bool(
            checks["text_artifact_exists"]
            and checks["image_artifact_exists"]
            and checks["text_checksum_match"]
            and checks["image_checksum_match"]
        )

        details.update(
            {
                "model_family": spec.model_family,
                "labels": spec.labels,
                "text_artifact_path": str(spec.text_artifact.path),
                "image_artifact_path": str(spec.image_artifact.path),
                "text_expected_sha256": spec.text_artifact.sha256,
                "image_expected_sha256": spec.image_artifact.sha256,
            }
        )
    except Exception as exc:
        details["resolution_error"] = str(exc)

    try:
        model = get_model_service()
        checks["model_service_loaded"] = bool(model.model_version and model.model_version != "unknown")
    except Exception as exc:
        details["model_service_error"] = str(exc)

    status = "healthy" if all(bool(v) for v in checks.values()) else "degraded"

    return {
        "status": status,
        "active_model_version": active_version,
        "checks": checks,
        "details": details,
    }


@app.get("/health/model")
def health_model() -> JSONResponse:
    model_health = _build_model_health()
    status_code = 200 if model_health["status"] == "healthy" else 503
    return JSONResponse(status_code=status_code, content=model_health)


@app.exception_handler(HTTPException)
async def _http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    code = str(exc.detail) if isinstance(exc.detail, str) else "http_error"
    status_code = int(exc.status_code)
    if status_code >= 500:
        category = "inference" if "inference" in code or "model" in code else "system"
        message = "Service temporarily unavailable." if category == "inference" else "Internal system error."
    else:
        category = "validation"
        message = "Request validation failed."
    return _error_response(request, status_code=status_code, category=category, code=code, message=message)


@app.exception_handler(RequestValidationError)
async def _request_validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    logger.info("request_validation_error", extra={"errors": exc.errors()})
    return _error_response(
        request,
        status_code=422,
        category="validation",
        code="request_validation_error",
        message="Request payload failed schema validation.",
    )


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("unhandled_exception", extra={"path": request.url.path}, exc_info=True)
    return _error_response(
        request,
        status_code=500,
        category="system",
        code="internal_server_error",
        message="An internal system error occurred.",
    )
