"""Prompt loading utilities for orchestrator, normalizer, rewriter, refiner, guardrail and fallback."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from threading import Lock

from metabrain.config import NLGSettings, get_settings
from metabrain.logger import get_logger


logger = get_logger(__name__)


@dataclass(frozen=True)
class PromptSource:
    path: str
    loaded: bool
    fallback_used: bool


@dataclass
class _CachedPrompt:
    mtime: float
    content: str


class PromptLoader:
    """Loads prompts from disk with mtime-based in-memory caching."""

    def __init__(self, prompts_dir: Path | None = None, *, settings: NLGSettings | None = None) -> None:
        self._settings = settings or get_settings()
        self._prompts_dir = (prompts_dir or self._settings.nlg_prompts_dir).resolve()
        self._cache: dict[str, _CachedPrompt] = {}
        self._sources: dict[str, PromptSource] = {}
        self._lock = Lock()

    @property
    def prompts_dir(self) -> Path:
        return self._prompts_dir

    def available_prompts(self) -> list[str]:
        files = []
        for file in sorted(self._prompts_dir.glob("*.txt")):
            if file.is_file():
                files.append(file.name)
        return files

    def describe_sources(self) -> dict[str, dict[str, object]]:
        return {
            name: {
                "path": source.path,
                "loaded": source.loaded,
                "fallback_used": source.fallback_used,
            }
            for name, source in self._sources.items()
        }

    def clear_cache(self) -> None:
        with self._lock:
            self._cache.clear()

    def load_prompt(self, prompt_name: str, fallback: str | None = None) -> str:
        filename = self._normalize_filename(prompt_name)
        prompt_path = (self._prompts_dir / filename).resolve()

        try:
            stat = prompt_path.stat()
        except FileNotFoundError:
            if fallback is not None:
                self._sources[filename] = PromptSource(
                    path=str(prompt_path),
                    loaded=False,
                    fallback_used=True,
                )
                logger.info("prompt_fallback_used", extra={"prompt": filename, "reason": "file_not_found"})
                return fallback.strip()
            raise FileNotFoundError(f"Prompt no encontrado: {prompt_path}")

        with self._lock:
            cached = self._cache.get(filename)
            if cached is not None and cached.mtime == stat.st_mtime:
                return cached.content

        content = prompt_path.read_text(encoding="utf-8").strip()
        if not content:
            if fallback is not None:
                self._sources[filename] = PromptSource(
                    path=str(prompt_path),
                    loaded=False,
                    fallback_used=True,
                )
                logger.info("prompt_fallback_used", extra={"prompt": filename, "reason": "empty_file"})
                return fallback.strip()
            raise ValueError(f"Prompt vacio: {prompt_path}")

        with self._lock:
            self._cache[filename] = _CachedPrompt(mtime=stat.st_mtime, content=content)

        self._sources[filename] = PromptSource(
            path=str(prompt_path),
            loaded=True,
            fallback_used=False,
        )
        return content

    def load_many(self, names: list[str]) -> dict[str, str]:
        loaded: dict[str, str] = {}
        for name in names:
            loaded[name] = self.load_prompt(name)
        return loaded

    def _normalize_filename(self, name: str) -> str:
        candidate = (name or "").strip()
        if not candidate:
            raise ValueError("El nombre del prompt no puede estar vacio.")

        if "/" in candidate or "\\" in candidate or ".." in candidate:
            raise ValueError("Nombre de prompt invalido: no se permite path traversal.")

        if not candidate.endswith(".txt"):
            candidate = f"{candidate}.txt"

        return candidate
