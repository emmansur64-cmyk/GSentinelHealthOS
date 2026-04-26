"""Gestión de sesiones para el orquestador central.

Responsabilidades:
  - Generar session_id UUID cuando no existe
  - Persistir estado completo de sesión en Redis con TTL
  - Cache de inferencia invalidado por CONTEXTO (no solo por intent)
  - Conteo de turnos (turn_count) para conversation depth awareness

Esquema del estado de sesión:
  {
    "last_intent": str,
    "last_step": str,
    "turn_count": int,
    "cached_intent": str | None,
    "cached_context_hash": str | None,   # hash del contexto al momento del cache
    "cached_inference": dict | None,
    "cached_decision": dict | None,
  }

El cache es VÁLIDO solo si:
  1. cached_intent == intent actual
  2. cached_context_hash == hash del contexto actual

Esto garantiza que si los síntomas o patient_data cambian, se re-infiere.
"""

from __future__ import annotations

import hashlib
import json
import uuid
import logging
from copy import deepcopy
from typing import Any, Dict, List, Optional, Tuple

from redis.asyncio import Redis

from brain.core.config import settings

logger = logging.getLogger(__name__)

_KEY_PREFIX = "orch:session"


class OrchestratorSessionManager:
    """Gestiona sesiones del orquestador central sobre Redis.

    No duplica al StateManager existente del Brain; opera bajo
    el namespace 'orch:session:*' para no colisionar con
    'chat_state:*' del booking orchestrator.
    """

    def __init__(
        self,
        redis_client: Redis | None = None,
        redis_url: str | None = None,
        ttl_seconds: int | None = None,
    ) -> None:
        self._client: Redis = redis_client or Redis.from_url(
            redis_url or settings.redis_url,
            decode_responses=True,
        )
        self.ttl_seconds = ttl_seconds or settings.state_ttl_seconds
        self._local_states: Dict[str, Dict[str, Any]] = {}

    @property
    def redis_client(self) -> Redis:
        return self._client

    # ── Helpers de clave ─────────────────────────────────────────────────────

    def _key(self, session_id: str) -> str:
        return f"{_KEY_PREFIX}:{session_id}"

    def _clone_state(self, state: Dict[str, Any]) -> Dict[str, Any]:
        return deepcopy(state)

    def _get_local_state(self, session_id: str) -> Dict[str, Any]:
        return self._clone_state(self._local_states.get(session_id, {}))

    def _set_local_state(self, session_id: str, state: Dict[str, Any]) -> None:
        self._local_states[session_id] = self._clone_state(state)

    # ── Generación de IDs ─────────────────────────────────────────────────────

    @staticmethod
    def new_session_id() -> str:
        """Genera un UUID v4 como session_id."""
        return str(uuid.uuid4())

    # ── Operaciones de sesión ─────────────────────────────────────────────────

    async def get_or_create(
        self, session_id: str | None
    ) -> Tuple[str, Dict[str, Any]]:
        """Retorna (session_id, state).

        Si session_id es None o no existe en Redis, crea una sesión nueva vacía.
        Siempre refresca el TTL al leer.
        """
        if not session_id:
            session_id = self.new_session_id()
            state: Dict[str, Any] = {}
            logger.debug("Nueva sesión creada: %s", session_id)
        else:
            try:
                raw = await self._client.get(self._key(session_id))
            except Exception as exc:
                logger.warning(
                    "Redis no disponible en get_or_create(%s), usando memoria local: %s",
                    session_id,
                    exc,
                )
                raw = None
                state = self._get_local_state(session_id)
            else:
                if raw is None:
                    state = {}
                    logger.debug("Sesión %s no encontrada, iniciando vacía.", session_id)
                else:
                    try:
                        state = json.loads(raw)
                    except json.JSONDecodeError:
                        logger.warning(
                            "Estado de sesión %s corrupto, reiniciando.", session_id
                        )
                        state = {}

        self._set_local_state(session_id, state)

        return session_id, state

    async def save(self, session_id: str, state: Dict[str, Any]) -> None:
        """Persiste el estado y refresca TTL."""
        self._set_local_state(session_id, state)
        try:
            await self._client.setex(
                self._key(session_id),
                self.ttl_seconds,
                json.dumps(state, default=str),
            )
            logger.debug("Sesión %s guardada (TTL=%ds).", session_id, self.ttl_seconds)
        except Exception as exc:
            logger.warning(
                "Redis no disponible en save(%s), estado persistido solo en memoria: %s",
                session_id,
                exc,
            )

    async def get(self, session_id: str) -> Dict[str, Any]:
        """Lectura directa sin crear sesión nueva."""
        try:
            raw = await self._client.get(self._key(session_id))
        except Exception as exc:
            logger.warning(
                "Redis no disponible en get(%s), usando memoria local: %s",
                session_id,
                exc,
            )
            return self._get_local_state(session_id)

        if raw is None:
            return self._get_local_state(session_id)
        try:
            state = json.loads(raw)
        except json.JSONDecodeError:
            return self._get_local_state(session_id)

        self._set_local_state(session_id, state)
        return state

    async def delete(self, session_id: str) -> None:
        """Elimina la sesión explícitamente (reset voluntario)."""
        self._local_states.pop(session_id, None)
        try:
            await self._client.delete(self._key(session_id))
            logger.debug("Sesión %s eliminada.", session_id)
        except Exception as exc:
            logger.warning(
                "Redis no disponible en delete(%s), sesión eliminada solo en memoria: %s",
                session_id,
                exc,
            )

    # ── Turn count ────────────────────────────────────────────────────────────

    async def increment_turn(self, session_id: str, state: Dict[str, Any]) -> int:
        """Incrementa y retorna el contador de turnos de la sesión.

        Modifica `state` in-place; el llamador debe hacer `save()` después.
        """
        count = int(state.get("turn_count", 0)) + 1
        state["turn_count"] = count
        logger.debug("Sesión %s: turn_count=%d", session_id, count)
        return count

    # ── Hash de contexto ──────────────────────────────────────────────────────

    @staticmethod
    def compute_context_hash(context: Dict[str, Any]) -> str:
        """Genera un hash estable del contexto clínico relevante.

        Considera únicamente los campos que afectan la inferencia:
        symptoms, patient_data, entities.  Ignora campos administrativos
        (session_id, timestamps, etc.) para no invalidar el cache innecesariamente.

        Returns:
            Hex digest MD5 (8 chars) del contenido normalizado.
        """
        relevant: Dict[str, Any] = {
            "symptoms": sorted(context.get("symptoms") or []),
            "patient_data": context.get("patient_data") or {},
            "entities": context.get("entities") or {},
        }
        serialized = json.dumps(relevant, sort_keys=True, default=str)
        return hashlib.md5(serialized.encode()).hexdigest()[:12]  # noqa: S324 — solo identificador de cache

    # ── Acceso a caché de inferencia/decisión ─────────────────────────────────

    async def get_cached_analysis(
        self,
        session_id: str,
        intent: str,
        context_hash: str,
    ) -> Optional[Tuple[Dict[str, Any], Dict[str, Any]]]:
        """Retorna (inference_output, decision_output) si el cache es válido.

        El cache se considera INVÁLIDO (retorna None) si:
          - El intent cambió.
          - El hash de contexto cambió (síntomas o patient_data evolucionaron).
          - No hay datos cacheados.
        """
        state = await self.get(session_id)
        if (
            state.get("cached_intent") == intent
            and state.get("cached_context_hash") == context_hash
            and state.get("cached_inference") is not None
            and state.get("cached_decision") is not None
        ):
            logger.debug(
                "Cache válido session=%s intent=%s hash=%s",
                session_id,
                intent,
                context_hash,
            )
            return state["cached_inference"], state["cached_decision"]

        if state.get("cached_intent") == intent and state.get("cached_context_hash") != context_hash:
            logger.info(
                "Cache INVALIDADO por cambio de contexto | session=%s intent=%s "
                "old_hash=%s new_hash=%s",
                session_id,
                intent,
                state.get("cached_context_hash"),
                context_hash,
            )
        return None

    async def store_cached_analysis(
        self,
        session_id: str,
        intent: str,
        context_hash: str,
        inference_output: Dict[str, Any],
        decision_output: Dict[str, Any],
        existing_state: Dict[str, Any],
    ) -> None:
        """Guarda inferencia + decisión con su hash de contexto."""
        existing_state["cached_intent"] = intent
        existing_state["cached_context_hash"] = context_hash
        existing_state["cached_inference"] = inference_output
        existing_state["cached_decision"] = decision_output
        await self.save(session_id, existing_state)

    # ── Cierre ────────────────────────────────────────────────────────────────

    async def close(self) -> None:
        try:
            await self._client.aclose()
        except Exception:
            return
