import re
from typing import Any

from .telemetry_policy import DEFAULT_TELEMETRY_POLICY, TelemetryPolicy

SECRET_PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9_-]+"),
    re.compile(r"(api[_-]?key|token|password|secret)\s*[:=]\s*[\"']?[^\"',\s]+", re.I),
    re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I),
    re.compile(r"\+?\d[\d\s().-]{7,}\d"),
]


def _sanitize_string(value: str, policy: TelemetryPolicy) -> str:
    output = value[: policy.max_string_length]
    for pattern in SECRET_PATTERNS:
        output = pattern.sub("[REDACTED]", output)
    return output


def sanitize_telemetry_payload(payload: dict[str, Any], policy: TelemetryPolicy = DEFAULT_TELEMETRY_POLICY) -> dict[str, Any]:
    output: dict[str, Any] = {}
    for key, value in list(payload.items())[: policy.max_payload_keys]:
        lower = key.lower()
        if any(marker in lower for marker in ("image", "password", "token", "secret")):
            output[key] = "[REDACTED]"
        elif isinstance(value, str):
            output[key] = _sanitize_string(value, policy)
        elif isinstance(value, (int, float, bool)) or value is None:
            output[key] = value
        else:
            output[key] = "[SUMMARY_ONLY]"
    return output
