from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from functools import lru_cache

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader


API_KEY_HEADER_NAME = "X-API-Key"
_api_key_header = APIKeyHeader(name=API_KEY_HEADER_NAME, auto_error=False)


@dataclass(frozen=True)
class SecuritySettings:
    api_key: str
    cors_allow_origins: list[str]
    cors_allow_credentials: bool


def _parse_bool(value: str, default: bool) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def load_security_settings() -> SecuritySettings:
    api_key = os.getenv("CEREBRO_API_KEY", "").strip()

    raw_origins = os.getenv("CEREBRO_CORS_ALLOW_ORIGINS", "http://127.0.0.1:3000")
    cors_allow_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    cors_allow_credentials = _parse_bool(os.getenv("CEREBRO_CORS_ALLOW_CREDENTIALS", "false"), False)

    return SecuritySettings(
        api_key=api_key,
        cors_allow_origins=cors_allow_origins,
        cors_allow_credentials=cors_allow_credentials,
    )


@lru_cache(maxsize=1)
def get_security_settings_cached() -> SecuritySettings:
    return load_security_settings()


def clear_security_settings_cache() -> None:
    get_security_settings_cached.cache_clear()


def require_api_key(
    request: Request,
    provided_key: str | None = Depends(_api_key_header),
) -> None:
    settings = getattr(request.app.state, "security_settings", None) or get_security_settings_cached()
    if not settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="api_key_not_configured",
        )

    if not provided_key or not secrets.compare_digest(provided_key, settings.api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_api_key",
        )

    request.state.auth_scheme = "api_key"