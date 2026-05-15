"""Memoria semantica persistente por sesion usando Redis + FAISS."""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import time
import uuid
from pathlib import Path
from typing import Dict, List

import httpx
import numpy as np
from redis.asyncio import Redis

try:
    import faiss
except Exception:  # pragma: no cover - fallback defensivo
    faiss = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)


def _recency_score(timestamp: float, now: float) -> float:
    """Calcula score de recencia con decay exponencial suave.
    
    Rango: [0, 1]
    - timestamp = now → 1.0
    - timestamp = now - 1h → ~0.37
    - timestamp = now - 24h → muy cercano a 0
    """
    delta = now - timestamp
    # 3600 segundos = 1 hora como referencia
    return math.exp(-delta / 3600)


class SemanticMemory:
    def __init__(
        self,
        redis_client: Redis,
        dimension: int = 1536,
        max_records: int = 200,
        ttl_seconds: int = 7 * 24 * 60 * 60,
        index_dir: str = "artifacts/semantic_index",
    ) -> None:
        self.redis = redis_client
        self.dimension = dimension
        self.max_records = max_records
        self.ttl_seconds = ttl_seconds
        self._indexes: Dict[str, object] = {}
        self._index_versions: Dict[str, int] = {}
        self._session_locks: Dict[str, asyncio.Lock] = {}
        self._index_dir = Path(index_dir)
        self._index_dir.mkdir(parents=True, exist_ok=True)

    async def embed(self, text: str) -> np.ndarray:
        """Genera embedding float32 normalizado.

        Usa OpenAI embeddings si OPENAI_API_KEY esta disponible.
        Si falla, cae a embedding local hash-based para no romper el flujo.
        """
        remote = await self._embed_openai(text)
        if remote is not None:
            return remote

        vec = np.zeros(self.dimension, dtype=np.float32)
        for token in str(text or "").lower().split():
            idx = hash(token) % self.dimension
            vec[idx] += 1.0

        norm = float(np.linalg.norm(vec))
        if norm > 0.0:
            vec = vec / norm
        return vec.astype(np.float32)

    async def _embed_openai(self, text: str) -> np.ndarray | None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return None

        payload = {
            "model": "text-embedding-3-small",
            "input": text,
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/embeddings",
                    json=payload,
                    headers=headers,
                )
                response.raise_for_status()
                data = response.json()
        except Exception as exc:
            logger.warning("OpenAI embeddings fallback a local: %s", exc)
            return None

        embedding = data.get("data", [{}])[0].get("embedding")
        if not isinstance(embedding, list) or not embedding:
            return None

        vec = np.array(embedding, dtype=np.float32)
        if vec.shape[0] != self.dimension:
            logger.warning(
                "Dimension embeddings inesperada (%s). Esperada=%s",
                vec.shape[0],
                self.dimension,
            )
            return None

        norm = float(np.linalg.norm(vec))
        if norm > 0.0:
            vec = vec / norm
        return vec.astype(np.float32)

    async def store(self, session_id: str, text: str) -> None:
        cleaned = " ".join(str(text or "").split()).strip()
        if not cleaned or len(cleaned) < 10:
            return
        if self._is_simple_greeting(cleaned):
            return

        lock = self._get_session_lock(session_id)
        async with lock:
            try:
                distributed_token = await self._acquire_distributed_lock(session_id)
            except Exception as exc:
                logger.warning("SemanticMemory.store: Redis no disponible, skip session=%s: %s", session_id, exc)
                return
            if not distributed_token:
                logger.warning("No se pudo adquirir lock distribuido session=%s", session_id)
                return
            try:
                index = await self._get_or_build_index(session_id)
                vector = await self.embed(cleaned)

                # Evita duplicados semanticos casi identicos.
                if self._index_size(index) > 0:
                    best_score, _ = self._search_index(index, vector, top_k=1)
                    if best_score and best_score[0] >= 0.98:
                        return

                self._add_to_index(index, vector)

                text_key = self._texts_key(session_id)
                vector_key = self._vectors_key(session_id)
                timestamp_key = self._timestamps_key(session_id)

                # Guardar timestamp UNIX (float)
                now = time.time()
                await self.redis.rpush(text_key, cleaned)
                await self.redis.rpush(vector_key, json.dumps(vector.tolist()))
                await self.redis.rpush(timestamp_key, str(now))

                await self.redis.ltrim(text_key, -self.max_records, -1)
                await self.redis.ltrim(vector_key, -self.max_records, -1)
                await self.redis.ltrim(timestamp_key, -self.max_records, -1)

                if self.ttl_seconds > 0:
                    await self.redis.expire(text_key, self.ttl_seconds)
                    await self.redis.expire(vector_key, self.ttl_seconds)
                    await self.redis.expire(timestamp_key, self.ttl_seconds)
                    await self.redis.expire(self._version_key(session_id), self.ttl_seconds)
                    await self.redis.expire(self._dist_lock_key(session_id), 60)

                version = int(await self.redis.incr(self._version_key(session_id)))

                # Garantiza alineacion exacta entre Redis y el indice en memoria,
                # incluso cuando ltrim descarta elementos antiguos.
                rebuilt = await self._rebuild_index_from_redis(session_id)
                self._indexes[session_id] = rebuilt
                self._index_versions[session_id] = version
                self._save_index_snapshot(session_id, rebuilt, version)
            except Exception as exc:
                logger.warning("SemanticMemory.store fallo para session=%s: %s", session_id, exc)
            finally:
                await self._release_distributed_lock(session_id, distributed_token)

    async def search(self, session_id: str, query: str, top_k: int = 3) -> List[str]:
        cleaned_query = " ".join(str(query or "").split()).strip()
        if not cleaned_query:
            return []

        lock = self._get_session_lock(session_id)
        async with lock:
            try:
                await self._refresh_if_stale(session_id)
                index = await self._get_or_build_index(session_id)
                if self._index_size(index) == 0:
                    return []

                query_vec = await self.embed(cleaned_query)
                _, indices = self._search_index(index, query_vec, top_k=top_k * 3)
                raw_texts = await self.redis.lrange(self._texts_key(session_id), 0, -1)
                raw_timestamps = await self.redis.lrange(self._timestamps_key(session_id), 0, -1)

                texts = [item.decode() if isinstance(item, bytes) else str(item) for item in raw_texts]
                timestamps = []
                for item in raw_timestamps:
                    data = item.decode() if isinstance(item, bytes) else str(item)
                    try:
                        ts = float(data)
                        timestamps.append(ts)
                    except (ValueError, TypeError):
                        timestamps.append(0.0)

                if self._index_size(index) != len(texts):
                    index = await self._rebuild_index_from_redis(session_id)
                    self._indexes[session_id] = index
                    version = await self._get_version(session_id)
                    self._index_versions[session_id] = version
                    self._save_index_snapshot(session_id, index, version)
                    _, indices = self._search_index(index, query_vec, top_k=top_k * 3)

                # Ranking híbrido: similitud + recencia
                now = time.time()
                combined_scores = []
                scores, _ = self._search_index(index, query_vec, top_k=top_k * 3)

                for i, idx in enumerate(indices):
                    if not (0 <= idx < len(texts)):
                        continue

                    text = texts[idx]
                    ts = timestamps[idx] if idx < len(timestamps) else 0.0

                    # Similitud semántica (FAISS usa inner product en vectores normalizados = cosine)
                    sim_score = float(scores[i]) if i < len(scores) else 0.0
                    # Normalizar similitud a [0, 1]
                    sim_score_normalized = max(0.0, min(1.0, sim_score))

                    # Score de recencia [0, 1]
                    rec_score = _recency_score(ts, now)

                    # Combinación ponderada: α * similitud + (1 - α) * recencia
                    alpha = 0.7  # Peso semántico (70%) vs recencia (30%)
                    final_score = alpha * sim_score_normalized + (1 - alpha) * rec_score

                    combined_scores.append((final_score, text))

                # Ordenar por score final (descendente) y retornar top_k
                combined_scores.sort(key=lambda x: x[0], reverse=True)
                results = [text for _, text in combined_scores[:top_k]]

                return results
            except Exception as exc:
                logger.warning("SemanticMemory.search fallo para session=%s: %s", session_id, exc)
                return []

    async def _get_or_build_index(self, session_id: str):
        if session_id in self._indexes:
            return self._indexes[session_id]

        if faiss is not None:
            loaded = await self._load_index_snapshot(session_id)
            if loaded is not None:
                self._indexes[session_id] = loaded
                return loaded

        index = await self._rebuild_index_from_redis(session_id)
        self._indexes[session_id] = index
        version = await self._get_version(session_id)
        self._index_versions[session_id] = version
        self._save_index_snapshot(session_id, index, version)
        return index

    async def _refresh_if_stale(self, session_id: str) -> None:
        remote_version = await self._get_version(session_id)
        local_version = self._index_versions.get(session_id, -1)
        if remote_version <= local_version:
            return

        rebuilt = await self._rebuild_index_from_redis(session_id)
        self._indexes[session_id] = rebuilt
        self._index_versions[session_id] = remote_version
        self._save_index_snapshot(session_id, rebuilt, remote_version)

    async def _rebuild_index_from_redis(self, session_id: str):
        index = self._new_index()
        raw_vectors = await self.redis.lrange(self._vectors_key(session_id), 0, -1)

        vectors: List[np.ndarray] = []
        for item in raw_vectors:
            data = item.decode() if isinstance(item, bytes) else str(item)
            try:
                parsed = json.loads(data)
                vec = np.array(parsed, dtype=np.float32)
            except Exception:
                continue

            if vec.shape[0] != self.dimension:
                continue
            norm = float(np.linalg.norm(vec))
            if norm > 0.0:
                vec = (vec / norm).astype(np.float32)
            vectors.append(vec)

        if vectors:
            matrix = np.vstack(vectors).astype(np.float32)
            self._add_batch_to_index(index, matrix)

        return index

    def _new_index(self):
        if faiss is not None:
            return faiss.IndexFlatIP(self.dimension)
        return []

    async def _load_index_snapshot(self, session_id: str):
        if faiss is None:
            return None

        index_path = self._index_path(session_id)
        meta_path = self._meta_path(session_id)
        if not index_path.exists() or not meta_path.exists():
            return None

        try:
            raw_meta = meta_path.read_text(encoding="utf-8").strip() or "{}"
            metadata = json.loads(raw_meta)
            expected_count = int(metadata.get("count", 0))
            expected_version = int(metadata.get("version", -1))
            redis_count = int(await self.redis.llen(self._vectors_key(session_id)))
            redis_version = await self._get_version(session_id)
            if expected_count != redis_count:
                return None
            if expected_version != redis_version:
                return None

            index = faiss.read_index(str(index_path))
            if int(index.ntotal) != redis_count:
                return None
            self._index_versions[session_id] = redis_version
            return index
        except Exception as exc:
            logger.warning("No se pudo cargar snapshot FAISS session=%s: %s", session_id, exc)
            return None

    def _save_index_snapshot(self, session_id: str, index, version: int) -> None:
        if faiss is None:
            return

        index_path = self._index_path(session_id)
        meta_path = self._meta_path(session_id)
        try:
            faiss.write_index(index, str(index_path))
            meta = {"count": int(index.ntotal), "version": int(version)}
            meta_path.write_text(json.dumps(meta), encoding="utf-8")
        except Exception as exc:
            logger.warning("No se pudo guardar snapshot FAISS session=%s: %s", session_id, exc)

    async def _acquire_distributed_lock(self, session_id: str) -> str | None:
        token = str(uuid.uuid4())
        key = self._dist_lock_key(session_id)
        for _ in range(20):
            acquired = await self.redis.set(key, token, ex=15, nx=True)
            if acquired:
                return token
            await asyncio.sleep(0.05)
        return None

    async def _release_distributed_lock(self, session_id: str, token: str) -> None:
        key = self._dist_lock_key(session_id)
        script = """
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
"""
        try:
            await self.redis.eval(script, 1, key, token)
        except Exception:
            logger.debug("No se pudo liberar lock distribuido session=%s", session_id)

    async def _get_version(self, session_id: str) -> int:
        raw = await self.redis.get(self._version_key(session_id))
        if raw is None:
            return 0
        try:
            return int(raw)
        except Exception:
            return 0

    def _add_to_index(self, index, vector: np.ndarray) -> None:
        if faiss is not None:
            index.add(vector.reshape(1, -1).astype(np.float32))
            return
        index.append(vector)

    def _add_batch_to_index(self, index, matrix: np.ndarray) -> None:
        if faiss is not None:
            index.add(matrix)
            return
        index.extend([row for row in matrix])

    def _search_index(self, index, query_vec: np.ndarray, top_k: int) -> tuple[List[float], List[int]]:
        top_k = max(1, top_k)
        if faiss is not None:
            scores, indices = index.search(query_vec.reshape(1, -1).astype(np.float32), top_k)
            return list(scores[0]), [int(i) for i in indices[0] if i >= 0]

        scores: List[tuple[float, int]] = []
        for idx, vec in enumerate(index):
            score = _cosine_similarity_np(query_vec, vec)
            scores.append((score, idx))
        scores.sort(key=lambda item: item[0], reverse=True)
        selected = scores[:top_k]
        return [score for score, _ in selected], [idx for _, idx in selected]

    def _index_size(self, index) -> int:
        if faiss is not None:
            return int(index.ntotal)
        return len(index)

    def _get_session_lock(self, session_id: str) -> asyncio.Lock:
        lock = self._session_locks.get(session_id)
        if lock is None:
            lock = asyncio.Lock()
            self._session_locks[session_id] = lock
        return lock

    @staticmethod
    def _is_simple_greeting(text: str) -> bool:
        normalized = text.lower().strip(" .,!?:;¡¿")
        return normalized in {"hola", "buenas", "hey", "que tal", "qué tal"}

    @staticmethod
    def _texts_key(session_id: str) -> str:
        return f"semantic_memory:{session_id}:texts"

    @staticmethod
    def _vectors_key(session_id: str) -> str:
        return f"semantic_memory:{session_id}:vectors"

    @staticmethod
    def _timestamps_key(session_id: str) -> str:
        return f"semantic_memory:{session_id}:timestamps"

    @staticmethod
    def _version_key(session_id: str) -> str:
        return f"semantic_memory:{session_id}:version"

    @staticmethod
    def _dist_lock_key(session_id: str) -> str:
        return f"semantic_memory:{session_id}:lock"

    def _index_path(self, session_id: str) -> Path:
        return self._index_dir / f"{session_id}.faiss"

    def _meta_path(self, session_id: str) -> Path:
        return self._index_dir / f"{session_id}.meta"


def _cosine_similarity_np(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    dot = float(np.dot(vec_a, vec_b))
    norm = float(np.linalg.norm(vec_a) * np.linalg.norm(vec_b))
    if norm <= 0.0:
        return 0.0
    return dot / norm
