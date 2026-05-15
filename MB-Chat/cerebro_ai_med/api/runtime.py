from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class RuntimeSettings:
    app_env: str
    api_version: str
    request_timeout_seconds: float
    max_request_body_bytes: int
    max_text_chars: int | None
    max_image_bytes: int
    rate_limit_enabled: bool
    rate_limit_requests: int
    rate_limit_window_seconds: int
    rate_limit_redis_url: str
    rate_limit_fail_open: bool


def _parse_bool(raw: str, default: bool) -> bool:
    normalized = (raw or "").strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def _parse_int(raw: str, default: int, minimum: int) -> int:
    try:
        value = int(str(raw).strip())
    except (TypeError, ValueError):
        return default
    return max(value, minimum)


def _parse_float(raw: str, default: float, minimum: float) -> float:
    try:
        value = float(str(raw).strip())
    except (TypeError, ValueError):
        return default
    return max(value, minimum)


def _parse_optional_limit(raw: str | None, default: int, minimum: int) -> int | None:
    value = (raw or "").strip().lower()
    if value in {"", "none", "null", "unlimited", "inf", "infinite"}:
        return None

    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default

    if parsed <= 0:
        return None
    return max(parsed, minimum)


def load_runtime_settings() -> RuntimeSettings:
    return RuntimeSettings(
        app_env=os.getenv("APP_ENV", "local").strip().lower() or "local",
        api_version=os.getenv("CEREBRO_API_VERSION", "1.2.0").strip() or "1.2.0",
        request_timeout_seconds=_parse_float(os.getenv("CEREBRO_REQUEST_TIMEOUT_SECONDS", "15"), 15.0, 1.0),
        max_request_body_bytes=_parse_int(os.getenv("CEREBRO_MAX_REQUEST_BODY_BYTES", str(10 * 1024 * 1024)), 10 * 1024 * 1024, 1024),
        max_text_chars=_parse_optional_limit(os.getenv("CEREBRO_MAX_TEXT_CHARS", "0"), 12000, 128),
        max_image_bytes=_parse_int(os.getenv("CEREBRO_MAX_IMAGE_BYTES", str(10 * 1024 * 1024)), 10 * 1024 * 1024, 1024),
        rate_limit_enabled=_parse_bool(os.getenv("CEREBRO_RATE_LIMIT_ENABLED", "true"), True),
        rate_limit_requests=_parse_int(os.getenv("CEREBRO_RATE_LIMIT_REQUESTS", "120"), 120, 1),
        rate_limit_window_seconds=_parse_int(os.getenv("CEREBRO_RATE_LIMIT_WINDOW_SECONDS", "60"), 60, 1),
        rate_limit_redis_url=os.getenv("CEREBRO_REDIS_URL", "redis://127.0.0.1:6379/0").strip(),
        rate_limit_fail_open=_parse_bool(os.getenv("CEREBRO_RATE_LIMIT_FAIL_OPEN", "true"), True),
    )
