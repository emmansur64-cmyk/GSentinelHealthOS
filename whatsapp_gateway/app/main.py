"""Main del WhatsApp Gateway - FastAPI app ligera."""

from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from shared.config import (
    ENV,
    REDIS_URL,
    WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_APP_SECRET,
    WHATSAPP_BUSINESS_ACCOUNT_ID,
    WHATSAPP_PHONE_NUMBER_ID,
    create_redis_master_client,
)
from whatsapp_gateway.api.routes import webhook
from whatsapp_gateway.app.outgoing_consumer import WhatsAppOutgoingConsumer
from shared.utils import setup_logger

logger = setup_logger(__name__)


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


async def _gateway_preflight() -> None:
    redis_url = os.environ.get("REDIS_URL", "")
    whatsapp_phone_number_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
    whatsapp_business_account_id = os.environ.get("WHATSAPP_BUSINESS_ACCOUNT_ID", "")

    errors: list[str] = []
    if not (redis_url or "").strip():
        errors.append("REDIS_URL no configurado")
    if "localhost" in redis_url or "127.0.0.1" in redis_url:
        errors.append("REDIS_URL invalido para Docker production")
    if (os.getenv("REDIS_SENTINELS", "") or "").strip():
        errors.append("REDIS_SENTINELS no permitido en gateway production")
    if (os.getenv("REDIS_SENTINEL_MASTER", "") or "").strip():
        errors.append("REDIS_SENTINEL_MASTER no permitido en gateway production")
    if not (WHATSAPP_ACCESS_TOKEN or "").strip():
        errors.append("WHATSAPP_ACCESS_TOKEN no configurado")
    if not (WHATSAPP_APP_SECRET or "").strip():
        errors.append("WHATSAPP_APP_SECRET no configurado")
    if not (whatsapp_phone_number_id or "").strip():
        errors.append("WHATSAPP_PHONE_NUMBER_ID no configurado")
    if not (whatsapp_business_account_id or "").strip():
        errors.append("WHATSAPP_BUSINESS_ACCOUNT_ID no configurado")

    if errors:
        for error in errors:
            logger.critical("Gateway preflight variable faltante o invalida: %s", error)
        logger.critical("Gateway preflight fallo: %s", "; ".join(errors))
        raise RuntimeError("Gateway preflight fallo")

    redis_client = create_redis_master_client(decode_responses=True)
    try:
        await redis_client.ping()
        logger.info("Redis ping OK")
    except Exception as exc:
        logger.critical("Gateway preflight Redis fallo: %s", type(exc).__name__)
        raise RuntimeError("Gateway preflight Redis fallo") from exc
    finally:
        close_method = getattr(redis_client, "aclose", None)
        if close_method is not None:
            await close_method()
        else:
            await redis_client.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    gateway_enabled = _env_flag("ENABLE_WHATSAPP_GATEWAY", default=False)

    if not gateway_enabled:
        logger.info("WhatsApp Gateway legacy disabled; Next/BullMQ is primary pipeline")
        yield
        return

    if ENV == "production":
        await _gateway_preflight()

    consumer = WhatsAppOutgoingConsumer(
        webhook.whatsapp_service,
        account_resolver=webhook.account_resolver,
    )
    task = asyncio.create_task(consumer.start())
    app.state.outgoing_consumer = consumer
    app.state.outgoing_consumer_task = task
    try:
        yield
    finally:
        await consumer.stop()
        await webhook.shutdown_resources()
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

# Crear app
app = FastAPI(
    title="GSentinelHealthOS WhatsApp Gateway",
    description="Gateway ligero para integración con WhatsApp/Meta",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers
if _env_flag("ENABLE_WHATSAPP_GATEWAY", default=False):
    app.include_router(webhook.router)
    logger.info("WhatsApp Gateway legacy router enabled by flag ENABLE_WHATSAPP_GATEWAY")
else:
    logger.info("WhatsApp Gateway legacy router disabled; Next/BullMQ is primary pipeline")

logger.info("WhatsApp Gateway inicializado correctamente")


@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "GSentinelHealthOS WhatsApp Gateway",
        "webhook": "/webhook/whatsapp",
        "description": "Transporte ligero e inmortal"
    }


@app.get("/health")
def health():
    """Health check"""
    return {"status": "alive"}


@app.get("/health/whatsapp")
async def whatsapp_health():
    """Watchdog de WhatsApp: Redis y variables criticas."""
    checks = {
        "redis_connected": False,
        "token_present": bool((WHATSAPP_ACCESS_TOKEN or "").strip()),
        "app_secret_present": bool((WHATSAPP_APP_SECRET or "").strip()),
        "phone_id_valid": bool((WHATSAPP_PHONE_NUMBER_ID or "").strip()),
        "business_account_id_valid": bool((WHATSAPP_BUSINESS_ACCOUNT_ID or "").strip()),
        "gateway_alive": True,
    }

    redis_client = None
    try:
        redis_client = create_redis_master_client(decode_responses=True)
        pong = await redis_client.ping()
        checks["redis_connected"] = bool(pong)
    except Exception as exc:
        logger.error("health_whatsapp_redis_error: %s", exc)
    finally:
        if redis_client is not None:
            close_method = getattr(redis_client, "aclose", None)
            if close_method is not None:
                await close_method()
            else:
                await redis_client.close()

    if not all(checks.values()):
        raise HTTPException(status_code=503, detail=checks)

    return {"status": "ok", **checks}
