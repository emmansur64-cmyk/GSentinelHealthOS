from __future__ import annotations

import hashlib
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest


_HTTP_REQUESTS_TOTAL = Counter(
    "cerebro_http_requests_total",
    "Total HTTP requests handled by cerebro_ai_med.",
    ["method", "path", "status_code"],
)
_HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "cerebro_http_request_duration_seconds",
    "HTTP request latency in seconds.",
    ["method", "path"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1.0, 2.5, 5.0, 10.0),
)
_INFERENCE_TOTAL = Counter(
    "cerebro_inference_total",
    "Total inference requests.",
    ["source_type", "model_version", "risk_level"],
)
_INFERENCE_DURATION_SECONDS = Histogram(
    "cerebro_inference_duration_seconds",
    "Inference latency in seconds.",
    ["source_type", "model_version"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0),
)
_ERRORS_TOTAL = Counter(
    "cerebro_errors_total",
    "Total classified errors.",
    ["category", "code"],
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        for key, value in record.__dict__.items():
            if key in {
                "name",
                "msg",
                "args",
                "levelname",
                "levelno",
                "pathname",
                "filename",
                "module",
                "exc_info",
                "exc_text",
                "stack_info",
                "lineno",
                "funcName",
                "created",
                "msecs",
                "relativeCreated",
                "thread",
                "threadName",
                "processName",
                "process",
            }:
                continue
            payload[key] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=True)


def configure_json_logging() -> None:
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.handlers = [handler]


def anonymize_text(text: str) -> dict[str, Any]:
    normalized = text.strip()
    digest = hashlib.sha256(normalized.encode("utf-8", errors="ignore")).hexdigest()
    return {
        "text_sha256": digest,
        "text_length": len(normalized),
    }


def record_http_metrics(method: str, path: str, status_code: int, elapsed_seconds: float) -> None:
    _HTTP_REQUESTS_TOTAL.labels(method=method, path=path, status_code=str(status_code)).inc()
    _HTTP_REQUEST_DURATION_SECONDS.labels(method=method, path=path).observe(elapsed_seconds)


def record_inference_metrics(source_type: str, model_version: str, risk_level: str, elapsed_seconds: float) -> None:
    _INFERENCE_TOTAL.labels(source_type=source_type, model_version=model_version, risk_level=risk_level).inc()
    _INFERENCE_DURATION_SECONDS.labels(source_type=source_type, model_version=model_version).observe(elapsed_seconds)


def record_error_metric(category: str, code: str) -> None:
    _ERRORS_TOTAL.labels(category=category, code=code).inc()


def metrics_payload() -> tuple[bytes, str]:
    return generate_latest(), CONTENT_TYPE_LATEST
