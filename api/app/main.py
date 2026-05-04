"""Main del API - FastAPI app principal."""

from __future__ import annotations

import asyncio
import os
import sys

if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.app.middleware import IdempotencyMiddleware
from api.app.api.v1.endpoints import (
    admin,
    appointments,
    auth,
    brain_decide,
    clinics,
    dashboard,
    doctors,
    health,
    knowledge,
    patients,
    realtime,
    time_slots_simple,
    webhooks_google_calendar,
    webhooks_whatsapp,
)
from api.app.db.session import validate_async_database_runtime
from api.app.exceptions.handlers import register_exception_handlers
from api.app.core import settings
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

app.add_middleware(IdempotencyMiddleware)

register_exception_handlers(app)


@app.on_event("startup")
async def startup_runtime_checks() -> None:
    _validate_windows_psycopg_runtime()
    await validate_async_database_runtime()


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
app.include_router(time_slots_simple.router, prefix="/api/v1")
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
