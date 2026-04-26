from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")


@dataclass(frozen=True)
class DeploySettings:
    groq_api_key: str
    whatsapp_app_secret: str
    whatsapp_verify_token: str
    redis_url: str
    nlg_groq_enabled: bool
    nlg_groq_model: str
    nlg_groq_temperature: float
    gateway_port: int
    worker_heartbeat_ttl_seconds: int


def _parse_bool(raw: str, default: bool = False) -> bool:
    value = (raw or "").strip().lower()
    if value in {"1", "true", "yes", "on", "si"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return default


def _parse_float(raw: str, default: float) -> float:
    try:
        return float(raw)
    except (TypeError, ValueError):
        return default


def _parse_int(raw: str, default: int, minimum: int = 1) -> int:
    try:
        return max(minimum, int(raw))
    except (TypeError, ValueError):
        return default


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def load_settings() -> DeploySettings:
    settings = DeploySettings(
        groq_api_key=_required_env("GROQ_API_KEY"),
        whatsapp_app_secret=_required_env("WHATSAPP_APP_SECRET"),
        whatsapp_verify_token=_required_env("WHATSAPP_VERIFY_TOKEN"),
        redis_url=_required_env("REDIS_URL"),
        nlg_groq_enabled=_parse_bool(os.getenv("NLG_GROQ_ENABLED", "true"), True),
        nlg_groq_model=os.getenv("NLG_GROQ_MODEL", "llama-3.1-8b-instant").strip(),
        nlg_groq_temperature=_parse_float(os.getenv("NLG_GROQ_TEMPERATURE", "0.2"), 0.2),
        gateway_port=_parse_int(os.getenv("GATEWAY_PORT", "8080"), 8080),
        worker_heartbeat_ttl_seconds=_parse_int(
            os.getenv("WORKER_HEARTBEAT_TTL_SECONDS", "30"), 30
        ),
    )

    if not settings.nlg_groq_model:
        raise RuntimeError("NLG_GROQ_MODEL cannot be empty")
    return settings
