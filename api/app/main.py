"""Main del API - FastAPI app principal."""

from __future__ import annotations

import asyncio
import os
import sys

if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from api.app.middleware import IdempotencyMiddleware
from api.app.api.v1.endpoints import (
    admin,
    appointments,
    auth,
    brain_decide,
    buffer_slots,
    clinics,
    dashboard,
    doctors,
    health,
    knowledge,
    meta,
    patients,
    realtime,
    time_slots_simple,
    webhooks_google_calendar,
    webhooks_whatsapp,
)
from api.app.core import settings
from api.app.db.session import close_async_database_runtime, validate_async_database_runtime
from api.app.exceptions.handlers import register_exception_handlers
from api.app.runtime_integration import (
    initialize_runtime_integration_state,
    passive_runtime_integration_middleware,
)
from api.app.services.rate_limit import (
    RedisRateLimiter,
    build_redis_rate_limiter,
    resolve_rate_limit_identity,
)
from api.app.core.security import AUTH_COOKIE_NAME, AUTH_CSRF_COOKIE_NAME
from shared.utils import setup_logger

logger = setup_logger(__name__)


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _validate_windows_psycopg_runtime() -> None:
    """Falla temprano en runtime no compatible para evitar 500 tardios en auth."""
    if not sys.platform.startswith("win"):
        return
    if sys.version_info < (3, 14):
        return
    if not settings.database_url.lower().startswith("postgresql+psycopg://"):
        return

    loop_name = type(asyncio.get_running_loop()).__name__
    if "Proactor" in loop_name:
        raise RuntimeError(
            "Runtime no compatible: Windows + Python 3.14+ con postgresql+psycopg requiere "
            "SelectorEventLoop. Inicia la API con scripts/run_api_server.py "
            "o usa Python 3.13/3.12 para uvicorn directo."
        )

# Crear app
app = FastAPI(
    title=settings.api_title,
    description="Sistema de gestión de citas médicas",
    version=settings.api_version,
    debug=settings.debug,
)

# --- BLOQUEO DE SEGURIDAD CORS ---
# Lee orígenes permitidos desde .env via settings
# Estructura: allow_origins, allow_credentials=True para auth
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,  # Permite envío de cookies/auth headers
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Idempotency-Key"],
)
def _is_rate_limit_exempt(path: str) -> bool:
    return path == "/health" or path.startswith("/health/") or path == "/api/health" or path.startswith("/api/health/")


def _is_csrf_exempt(path: str) -> bool:
    return path in {
        "/api/v1/auth/token",
        "/api/v1/auth/logout",
        "/api/v1/webhooks/whatsapp",
        "/api/v1/webhooks/google-calendar",
    }


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if _is_rate_limit_exempt(request.url.path):
        return await call_next(request)

    limiter: RedisRateLimiter | None = getattr(request.app.state, "rate_limiter", None)
    if limiter is None:
        return await call_next(request)

    decision = await limiter.evaluate(resolve_rate_limit_identity(request))
    headers = {}
    if decision.backend != "disabled":
        headers.update(
            {
                "X-RateLimit-Limit": str(decision.limit),
                "X-RateLimit-Remaining": str(decision.remaining),
                "X-RateLimit-Reset": str(decision.reset_seconds),
                "X-RateLimit-Backend": decision.backend,
            }
        )
        if decision.degraded:
            headers["X-RateLimit-Degraded"] = "true"
    if not decision.allowed:
        headers["Retry-After"] = str(decision.reset_seconds)
        return JSONResponse(
            status_code=429,
            content={"detail": "rate_limit_exceeded"},
            headers=headers,
        )

    response = await call_next(request)
    response.headers.update(headers)
    return response


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and not _is_csrf_exempt(request.url.path):
        auth_cookie = request.cookies.get(AUTH_COOKIE_NAME)
        if auth_cookie:
            csrf_cookie = request.cookies.get(AUTH_CSRF_COOKIE_NAME)
            csrf_header = request.headers.get("x-csrf-token")
            if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
                return JSONResponse(
                    status_code=403,
                    content={"detail": "csrf_token_invalid"},
                )

    return await call_next(request)

app.add_middleware(IdempotencyMiddleware)

register_exception_handlers(app)
app.middleware("http")(passive_runtime_integration_middleware)


@app.on_event("startup")
async def startup_runtime_checks() -> None:
    _validate_windows_psycopg_runtime()
    initialize_runtime_integration_state(app)
    await validate_async_database_runtime()
    app.state.rate_limiter = await build_redis_rate_limiter(
        settings.redis_url,
        settings.rate_limit_per_minute,
        60,
    )
    app.state.auth_rate_limiter = await build_redis_rate_limiter(
        settings.redis_url,
        5,
        60,
    )


@app.on_event("shutdown")
async def shutdown_runtime_checks() -> None:
    limiter = getattr(app.state, "rate_limiter", None)
    if limiter is not None:
        await limiter.close()
    auth_limiter = getattr(app.state, "auth_rate_limiter", None)
    if auth_limiter is not None:
        await auth_limiter.close()
    await close_async_database_runtime()


# Registrar routers
app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(patients.router, prefix="/api/v1")
app.include_router(doctors.router, prefix="/api/v1")
app.include_router(appointments.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(knowledge.router, prefix="/api/v1")
app.include_router(clinics.router, prefix="/api/v1")
app.include_router(meta.router, prefix="/api")
app.include_router(time_slots_simple.router, prefix="/api/v1")
app.include_router(buffer_slots.router, prefix="/api/v1")
app.include_router(brain_decide.router, prefix="/api/v1")
if _env_flag("ENABLE_PY_WHATSAPP_WEBHOOK", default=False):
    app.include_router(webhooks_whatsapp.router, prefix="/api/v1")
    logger.info("Python WhatsApp webhook legacy enabled by flag ENABLE_PY_WHATSAPP_WEBHOOK")
else:
    logger.info("Python WhatsApp webhook legacy disabled; Next/BullMQ is primary pipeline")
app.include_router(webhooks_google_calendar.router, prefix="/api/v1")
app.include_router(realtime.router)

logger.info("API inicializada correctamente")


@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "GSentinelHealthOS API",
        "services": ["patients", "doctors"],
        "health": "/api/health/readiness"
    }
