from __future__ import annotations

import asyncio
import fnmatch

import pytest

from brain.orchestration.semantic_memory import SemanticMemory


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.lists: dict[str, list[str]] = {}
        self.expiry: dict[str, int] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def set(self, key: str, value: str, nx: bool = False, ex: int | None = None):
        if nx and key in self.store:
            return None
        self.store[key] = value
        if ex is not None:
            self.expiry[key] = ex
        return True

    async def delete(self, key: str) -> int:
        existed = 1 if key in self.store or key in self.lists else 0
        self.store.pop(key, None)
        self.lists.pop(key, None)
        self.expiry.pop(key, None)
        return existed

    async def eval(self, script: str, keys_count: int, key: str, token: str):
        assert keys_count == 1
        if self.store.get(key) == token:
            await self.delete(key)
            return 1
        return 0

    async def incr(self, key: str) -> int:
        current = int(self.store.get(key, "0"))
        current += 1
        self.store[key] = str(current)
        return current

    async def llen(self, key: str) -> int:
        return len(self.lists.get(key, []))

    async def lrange(self, key: str, start: int, end: int) -> list[str]:
        values = self.lists.get(key, [])
        if not values:
            return []

        size = len(values)
        if start < 0:
            start = size + start
        if end < 0:
            end = size + end

        start = max(0, start)
        end = min(size - 1, end)
        if end < start:
            return []
        return values[start : end + 1]

    async def rpush(self, key: str, value: str) -> int:
        self.lists.setdefault(key, []).append(value)
        return len(self.lists[key])

    async def ltrim(self, key: str, start: int, end: int) -> None:
        values = self.lists.get(key, [])
        if not values:
            return

        size = len(values)
        if start < 0:
            start = size + start
        if end < 0:
            end = size + end

        start = max(0, start)
        end = min(size - 1, end)
        if end < start:
            self.lists[key] = []
            return
        self.lists[key] = values[start : end + 1]

    async def expire(self, key: str, ttl: int) -> bool:
        if key in self.store or key in self.lists:
            self.expiry[key] = ttl
            return True
        return False

    async def keys(self, pattern: str) -> list[str]:
        merged = set(self.store.keys()) | set(self.lists.keys())
        return [item for item in merged if fnmatch.fnmatch(item, pattern)]


@pytest.mark.asyncio
async def test_semantic_memory_multi_worker_keeps_consistency(tmp_path) -> None:
    redis = FakeRedis()
    session_id = "session-concurrent-1"

    worker_a = SemanticMemory(redis_client=redis, index_dir=str(tmp_path / "semantic_idx"))
    worker_b = SemanticMemory(redis_client=redis, index_dir=str(tmp_path / "semantic_idx"))

    # Mensajes suficientemente largos para pasar filtros y generar carga concurrente.
    inputs_a = [f"Paciente con dolor toracico persistente turno A {i}" for i in range(20)]
    inputs_b = [f"Paciente con fiebre y cefalea worker B {i}" for i in range(20)]

    await asyncio.gather(
        *(worker_a.store(session_id, text) for text in inputs_a),
        *(worker_b.store(session_id, text) for text in inputs_b),
    )

    texts_key = f"semantic_memory:{session_id}:texts"
    vectors_key = f"semantic_memory:{session_id}:vectors"
    version_key = f"semantic_memory:{session_id}:version"

    texts = await redis.lrange(texts_key, 0, -1)
    vectors = await redis.lrange(vectors_key, 0, -1)
    version = await redis.get(version_key)

    assert len(texts) == len(vectors)
    assert len(texts) > 0
    assert len(texts) <= 200
    assert version is not None and int(version) >= len(texts)

    # Verifica que ambos workers pueden buscar sobre el estado consistente compartido.
    results_a = await worker_a.search(session_id, "dolor toracico", top_k=3)
    results_b = await worker_b.search(session_id, "fiebre cefalea", top_k=3)

    assert results_a
    assert results_b
    assert all(isinstance(item, str) and item for item in results_a)
    assert all(isinstance(item, str) and item for item in results_b)

    # El lock distribuido debe liberarse al terminar.
    lock_key = f"semantic_memory:{session_id}:lock"
    assert await redis.get(lock_key) is None
