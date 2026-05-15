"""Structured JSON logging for metabrain NLG components."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any


_RESERVED_LOG_RECORD_FIELDS = {
    "args",
    "asctime",
    "created",
    "exc_info",
    "exc_text",
    "filename",
    "funcName",
    "levelname",
    "levelno",
    "lineno",
    "module",
    "msecs",
    "message",
    "msg",
    "name",
    "pathname",
    "process",
    "processName",
    "relativeCreated",
    "stack_info",
    "thread",
    "threadName",
}


def _resolve_level(level: str | None) -> int:
    candidate = (level or os.getenv("NLG_LOG_LEVEL", "INFO")).strip().upper()
    return getattr(logging, candidate, logging.INFO)


class JsonFormatter(logging.Formatter):
    """Emit logs as one JSON object per line."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        for key, value in record.__dict__.items():
            if key in _RESERVED_LOG_RECORD_FIELDS or key.startswith("_"):
                continue
            if isinstance(value, (str, int, float, bool)) or value is None:
                payload[key] = value
            else:
                payload[key] = str(value)

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=True)


def configure_logging(level: str | None = None, *, force: bool = False) -> None:
    """Configure root logger once for JSON output."""
    root_logger = logging.getLogger()
    if root_logger.handlers and not force:
        return

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())

    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(_resolve_level(level))


def get_logger(name: str) -> logging.Logger:
    configure_logging()
    return logging.getLogger(name)


def mask_secret(value: str, keep: int = 4) -> str:
    """Mask sensitive values before logging."""
    if not value:
        return ""
    if len(value) <= keep:
        return "*" * len(value)
    return f"{'*' * (len(value) - keep)}{value[-keep:]}"
