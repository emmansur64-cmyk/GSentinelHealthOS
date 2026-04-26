"""Main del WhatsApp Gateway - FastAPI app ligera."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from whatsapp_gateway.api.routes import webhook
from whatsapp_gateway.app.outgoing_consumer import WhatsAppOutgoingConsumer
from shared.utils import setup_logger

logger = setup_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    consumer = WhatsAppOutgoingConsumer(webhook.whatsapp_service)
    task = asyncio.create_task(consumer.start())
    app.state.outgoing_consumer = consumer
    app.state.outgoing_consumer_task = task
    try:
        yield
    finally:
        await consumer.stop()
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
app.include_router(webhook.router)

logger.info("✓ WhatsApp Gateway inicializado correctamente")


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
