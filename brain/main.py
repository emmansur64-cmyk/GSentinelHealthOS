"""Worker de Brain consumiendo mensajes desde Redis."""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from redis.asyncio import Redis

from brain.core.config import settings
from brain.core.state_manager import StateManager
from brain.integration.api_client import APIClient
from brain.services.orchestrator import BrainOrchestrator
from shared.logging_utils import mask_phone
from shared.utils import setup_logger

logger = setup_logger(__name__)


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


class BrainWorker:
    """Worker que consume mensajes entrantes de WhatsApp."""
    
    def __init__(
        self,
        redis_url: str = settings.redis_url,
        queue_name: str = settings.incoming_queue_name,
        outgoing_queue_name: str = settings.outgoing_queue_name,
        *,
        redis_client: Redis | None = None,
        orchestrator: BrainOrchestrator | None = None,
        api_client: APIClient | None = None,
        state_manager: StateManager | None = None,
    ) -> None:
        self.redis_url = redis_url
        self.queue_name = queue_name
        self.outgoing_queue_name = outgoing_queue_name
        self.redis: Redis | None = redis_client
        self.api_client = api_client
        self.state_manager = state_manager
        self.orchestrator = orchestrator
        self.running = False

    async def _ensure_runtime(self) -> None:
        if self.redis is None:
            self.redis = Redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_keepalive=True,
                retry_on_timeout=True,
                health_check_interval=30,
            )

        if self.state_manager is None:
            self.state_manager = StateManager(client=self.redis)

        if self.api_client is None:
            self.api_client = APIClient()

        if self.orchestrator is None:
            self.orchestrator = BrainOrchestrator(
                state_manager=self.state_manager,
                api_client=self.api_client,
            )

    async def process_once(self, timeout: int = 5) -> bool:
        await self._ensure_runtime()
        redis_client = self.redis
        orchestrator = self.orchestrator
        state_manager = self.state_manager
        if redis_client is None or orchestrator is None or state_manager is None:
            raise RuntimeError("No se pudo inicializar el runtime del Brain")

        record = await redis_client.execute_command("BRPOP", self.queue_name, timeout)
        if record is None:
            return False

        _, raw_payload = record
        message: dict[str, Any]
        try:
            message = json.loads(raw_payload)
        except json.JSONDecodeError:
            logger.debug("Payload invalido en cola de entrada: %s", raw_payload)
            logger.warning("Mensaje invalido en cola de entrada")
            return False

        phone = message.get("phone") or message.get("from")
        clinic_id = message.get("clinic_id")
        if not phone:
            logger.warning("Mensaje sin telefono, se descarta")
            return False

        if await state_manager.is_bot_paused(phone, clinic_id=clinic_id):
            logger.info(
                "Ignorando mensaje de %s: Bot PAUSADO por medico.",
                mask_phone(phone),
            )
            return False

        async with state_manager.conversation_lock(phone, clinic_id=clinic_id) as locked:
            if not locked:
                await state_manager.incr_metric("lock_contention_total")
                response = {
                    "phone": phone,
                    "text": "Estoy procesando tu mensaje anterior, un momento por favor...",
                }
            else:
                try:
                    response = await orchestrator.handle_message(message)
                except Exception as exc:
                    logger.exception(
                        "Error procesando mensaje del Brain para %s: %s",
                        mask_phone(phone),
                        exc,
                    )
                    response = {
                        "phone": phone,
                        "text": "No pude procesar tu mensaje ahora mismo. Intenta nuevamente en unos minutos.",
                    }
                await state_manager.incr_metric("messages_processed_total")

        incoming_client_id = message.get("client_id")
        incoming_clinic_id = message.get("clinic_id")
        if incoming_client_id:
            response.setdefault("client_id", incoming_client_id)
            response.setdefault("to", response.get("phone"))
            response.setdefault("message", response.get("text"))
            if incoming_clinic_id:
                response.setdefault("clinic_id", incoming_clinic_id)
            if message.get("phone_number_id"):
                response.setdefault("phone_number_id", message.get("phone_number_id"))

        await redis_client.execute_command(
            "LPUSH",
            self.outgoing_queue_name,
            json.dumps(response),
        )
        logger.info(
            "Respuesta encolada en %s para %s",
            self.outgoing_queue_name,
            mask_phone(response.get("phone")),
        )
        return True
    
    async def start(self) -> None:
        logger.info("✓ Brain worker iniciado")
        self.running = True
        await self._ensure_runtime()
        
        try:
            logger.info("Brain worker consumiendo cola %s", self.queue_name)
            while self.running:
                await self.process_once(timeout=5)
        except Exception as e:
            logger.error(f"Error en Brain worker: {str(e)}")
        finally:
            await self.stop()
    
    async def stop(self) -> None:
        logger.info("Deteniendo Brain worker...")
        self.running = False
        if self.api_client is not None:
            await self.api_client.close()
            self.api_client = None
        if self.redis is not None:
            close_method = getattr(self.redis, "aclose", None)
            if close_method is not None:
                await close_method()
            else:
                await self.redis.close()
            self.redis = None
        self.state_manager = None
        self.orchestrator = None


async def _run_worker_only() -> None:
    """Corre únicamente el worker Redis (modo legado / standalone)."""
    if not _env_flag("ENABLE_BRAIN_REDIS_WORKER", default=False):
        logger.info("Brain Redis WhatsApp legacy worker disabled; Next/BullMQ is primary pipeline")
        return

    logger.info("Iniciando GSentinelHealthOS Brain (modo worker)...")
    worker = BrainWorker()
    try:
        await worker.start()
    except KeyboardInterrupt:
        logger.info("Shutting down worker...")
        await worker.stop()


def _run_http_server() -> None:
    """Arranca el servidor FastAPI + worker Redis integrado vía uvicorn."""
    import uvicorn  # import diferido: uvicorn no es obligatorio para el worker

    logger.info(
        "Iniciando GSentinelHealthOS Brain (modo HTTP) en %s:%d",
        settings.brain_host,
        settings.brain_port,
    )
    uvicorn.run(
        "brain.app:app",
        host=settings.brain_host,
        port=settings.brain_port,
        log_level="info",
        reload=False,
    )


def main() -> None:
    """Punto de entrada principal.

    Modos de arranque:
      - BRAIN_MODE=http    → FastAPI + worker Redis en background (default)
      - BRAIN_MODE=worker  → Solo worker Redis (compatibilidad hacia atrás)
    """
    import os

    mode = os.getenv("BRAIN_MODE", "http").lower()

    if mode == "worker":
        asyncio.run(_run_worker_only())
    else:
        # Modo HTTP: el worker se lanza como background task dentro del lifespan
        # de brain.app (ver brain/app.py → lifespan)
        _run_http_server()


if __name__ == "__main__":
    main()
