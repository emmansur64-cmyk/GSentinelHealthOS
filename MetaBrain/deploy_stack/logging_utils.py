from __future__ import annotations

import logging
import os

from metabrain.observability.logger import configure_observability_logging, get_logger


def bootstrap_logging() -> None:
    level = os.getenv("LOG_LEVEL", "INFO").strip().upper()
    configure_observability_logging(level=level)


def logger(name: str) -> logging.Logger:
    return get_logger(name)
