"""Centralized runtime configuration for Groq-based NLG infrastructure."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")


def _read_env(name: str, default: str | None = None) -> str:
    if default is None:
        return os.getenv(name, "").strip()
    return os.getenv(name, default).strip()


def _parse_bool(raw: str, *, default: bool) -> bool:
    normalized = (raw or "").strip().lower()
    if normalized in {"1", "true", "yes", "on", "si"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def _parse_float(raw: str, *, default: float, min_value: float, max_value: float) -> float:
    try:
        parsed = float(raw)
    except (TypeError, ValueError):
        return default
    return max(min_value, min(max_value, parsed))


def _parse_int(raw: str, *, default: int, min_value: int, max_value: int) -> int:
    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        return default
    return max(min_value, min(max_value, parsed))


def _resolve_path(raw_path: str, *, base_dir: Path) -> Path:
    path = Path(raw_path)
    if not path.is_absolute():
        path = base_dir / path
    return path.resolve()


@dataclass(frozen=True)
class NLGSettings:
    groq_api_key: str = field(repr=False)
    nlg_groq_enabled: bool
    nlg_groq_model: str
    nlg_groq_temperature: float
    nlg_groq_max_tokens: int
    nlg_prompts_dir: Path
    nlg_groq_enable_rewriter: bool
    nlg_internal_diagnostics_enabled: bool
    nlg_internal_diagnostics_token: str = field(default="", repr=False)
    nlg_groq_timeout_seconds: float = 20.0
    nlg_cache_ttl_seconds: int = 300
    nlg_cache_max_entries: int = 256

    def validate(self) -> None:
        if self.nlg_groq_enabled and not self.groq_api_key:
            raise EnvironmentError(
                "NLG_GROQ_ENABLED=true requiere GROQ_API_KEY configurada en entorno o .env."
            )

        if not self.nlg_groq_model:
            raise EnvironmentError("NLG_GROQ_MODEL no puede estar vacia.")

        if not self.nlg_prompts_dir.exists() or not self.nlg_prompts_dir.is_dir():
            raise EnvironmentError(
                f"NLG_PROMPTS_DIR no existe o no es carpeta valida: {self.nlg_prompts_dir}"
            )

        if self.nlg_internal_diagnostics_enabled and not self.nlg_internal_diagnostics_token:
            raise EnvironmentError(
                "NLG_INTERNAL_DIAGNOSTICS_ENABLED=true requiere NLG_INTERNAL_DIAGNOSTICS_TOKEN."
            )


@lru_cache(maxsize=1)
def get_settings() -> NLGSettings:
    prompts_dir = _resolve_path(_read_env("NLG_PROMPTS_DIR", "metabrain/prompts"), base_dir=ROOT_DIR)

    settings = NLGSettings(
        groq_api_key=_read_env("GROQ_API_KEY"),
        nlg_groq_enabled=_parse_bool(_read_env("NLG_GROQ_ENABLED", "true"), default=True),
        nlg_groq_model=_read_env("NLG_GROQ_MODEL", "llama-3.3-70b-versatile") or "llama-3.3-70b-versatile",
        nlg_groq_temperature=_parse_float(
            _read_env("NLG_GROQ_TEMPERATURE", "0.4"),
            default=0.4,
            min_value=0.0,
            max_value=2.0,
        ),
        nlg_groq_max_tokens=_parse_int(
            _read_env("NLG_GROQ_MAX_TOKENS", "700"),
            default=700,
            min_value=64,
            max_value=4096,
        ),
        nlg_prompts_dir=prompts_dir,
        nlg_groq_enable_rewriter=_parse_bool(
            _read_env("NLG_GROQ_ENABLE_REWRITER", "true"),
            default=True,
        ),
        nlg_internal_diagnostics_enabled=_parse_bool(
            _read_env("NLG_INTERNAL_DIAGNOSTICS_ENABLED", "false"),
            default=False,
        ),
        nlg_internal_diagnostics_token=_read_env("NLG_INTERNAL_DIAGNOSTICS_TOKEN", ""),
        nlg_groq_timeout_seconds=_parse_float(
            _read_env("NLG_GROQ_TIMEOUT_SECONDS", "20"),
            default=20.0,
            min_value=1.0,
            max_value=120.0,
        ),
        nlg_cache_ttl_seconds=_parse_int(
            _read_env("NLG_CACHE_TTL_SECONDS", "300"),
            default=300,
            min_value=1,
            max_value=3600,
        ),
        nlg_cache_max_entries=_parse_int(
            _read_env("NLG_CACHE_MAX_ENTRIES", "256"),
            default=256,
            min_value=32,
            max_value=10000,
        ),
    )
    settings.validate()
    return settings


def reload_settings() -> NLGSettings:
    get_settings.cache_clear()
    return get_settings()


SETTINGS = get_settings()


# Backward-compatible aliases used by existing imports.
GROQ_API_KEY: str = SETTINGS.groq_api_key
GROQ_MODEL: str = SETTINGS.nlg_groq_model
GROQ_TEMPERATURE: float = SETTINGS.nlg_groq_temperature
GROQ_MAX_TOKENS: int = SETTINGS.nlg_groq_max_tokens
GROQ_ENABLE_REWRITER: bool = SETTINGS.nlg_groq_enable_rewriter
GROQ_ENABLED: bool = SETTINGS.nlg_groq_enabled
PROMPTS_DIR: Path = SETTINGS.nlg_prompts_dir
INTERNAL_DIAGNOSTICS_ENABLED: bool = SETTINGS.nlg_internal_diagnostics_enabled
INTERNAL_DIAGNOSTICS_TOKEN: str = SETTINGS.nlg_internal_diagnostics_token
CEREBRO_API_KEY: str = _read_env("CEREBRO_API_KEY", "")
