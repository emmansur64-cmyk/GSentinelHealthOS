"""Structured JSON logger with request-scoped context for production observability.

Provides:
- JSON output (one object per line)
- contextvars-based request_id / user_id injection
- Safe filtering of sensitive fields (API keys, tokens)
- Factory function compatible with existing metabrain.logger API
"""

from __future__ import annotations

import json
import logging
import os
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any

# ── Context variables injected per request ───────────────────────────────────
_ctx_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)
_ctx_user_id: ContextVar[str | None] = ContextVar("user_id", default=None)


def set_request_context(*, request_id: str | None = None, user_id: str | None = None) -> None:
    """Bind observability context for the current async task / thread."""
    if request_id is not None:
        _ctx_request_id.set(request_id)
    if user_id is not None:
        _ctx_user_id.set(user_id)


def clear_request_context() -> None:
    """Reset context at the end of a request."""
    _ctx_request_id.set(None)
    _ctx_user_id.set(None)


# ── Fields that must never appear in log output ───────────────────────────────
_BLOCKED_FIELDS = frozenset(
    {
        "api_key",
        "groq_api_key",
        "authorization",
        "token",
        "secret",
        "password",
        "passwd",
        "credential",
        "x_api_key",
    }
)

_RESERVED_LOG_RECORD_FIELDS = frozenset(
    {
        "args", "asctime", "created", "exc_info", "exc_text",
        "filename", "funcName", "levelname", "levelno", "lineno",
        "module", "msecs", "message", "msg", "name", "pathname",
        "process", "processName", "relativeCreated", "stack_info",
        "thread", "threadName",
    }
)


def _sanitize(value: Any, key: str) -> Any:
    """Return redacted sentinel if key is sensitive; otherwise normalize value."""
    if key.lower() in _BLOCKED_FIELDS:
        return "[REDACTED]"
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


class ObservabilityJsonFormatter(logging.Formatter):
    """Emit each log record as a compact JSON object on a single line."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Inject request context when available
        rid = _ctx_request_id.get()
        uid = _ctx_user_id.get()
        if rid:
            payload["request_id"] = rid
        if uid:
            payload["user_id"] = uid

        # Attach structured extra fields, sanitized
        for key, value in record.__dict__.items():
            if key in _RESERVED_LOG_RECORD_FIELDS or key.startswith("_"):
                continue
            payload[key] = _sanitize(value, key)

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=True, default=str)


def _resolve_level(level: str | None) -> int:
    candidate = (level or os.getenv("NLG_LOG_LEVEL", "INFO")).strip().upper()
    return getattr(logging, candidate, logging.INFO)


def configure_observability_logging(level: str | None = None, *, force: bool = False) -> None:
    """Configure root logger for JSON structured output. Idempotent unless force=True."""
    root = logging.getLogger()
    if root.handlers and not force:
        return

    handler = logging.StreamHandler()
    handler.setFormatter(ObservabilityJsonFormatter())
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(_resolve_level(level))


def get_logger(name: str) -> logging.Logger:
    """Return a named logger. Ensures the root handler is configured."""
    configure_observability_logging()
    return logging.getLogger(name)
