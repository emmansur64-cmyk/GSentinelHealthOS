from __future__ import annotations

import re
from dataclasses import replace
from typing import Any

from .types import ProviderRequest

EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)")
DOCUMENT_RE = re.compile(r"\b(?:dni|documento|passport|pasaporte|ssn|cuit|cuil|rut)\s*[:#-]?\s*[A-Z0-9.\-]{5,}\b", re.IGNORECASE)
SECRET_RE = re.compile(r"\b(?:api[_-]?key|secret|token|password|passwd|authorization|bearer)\s*[:=]\s*[\"']?[^\"'\s,;]{8,}", re.IGNORECASE)


def sanitize_provider_request(request: ProviderRequest, phi_allowed: bool = False) -> dict[str, Any]:
    text = request.input_text or ""
    flags: list[str] = []
    phi_detected = bool(request.patient_id)

    for regex, marker, is_phi in [
        (SECRET_RE, "SECRET", False),
        (EMAIL_RE, "EMAIL", True),
        (PHONE_RE, "PHONE", True),
        (DOCUMENT_RE, "DOCUMENT", True),
    ]:
        if regex.search(text):
            flags.append(marker)
            if is_phi:
                phi_detected = True
            text = regex.sub(f"[REDACTED_{marker}]", text)

    metadata = _sanitize_metadata(request.metadata, flags)
    blocked = bool((phi_detected or request.safety_level == "phi_possible") and not phi_allowed)
    if blocked:
        flags.append("PHI_BLOCKED_BY_POLICY")

    return {
        "request": replace(request, input_text=text, metadata=metadata, patient_id=request.patient_id if phi_allowed else None),
        "phi_detected": phi_detected,
        "blocked_by_policy": blocked,
        "safety_flags": sorted(set(flags)),
    }


def _sanitize_metadata(metadata: dict[str, Any], flags: list[str]) -> dict[str, Any]:
    sanitized: dict[str, Any] = {}
    for key, value in (metadata or {}).items():
        lower = key.lower()
        if any(item in lower for item in ("token", "secret", "password", "api_key", "authorization", "cookie")):
            sanitized[key] = "[REDACTED_METADATA]"
            flags.append("SECRET_METADATA")
        elif any(item in lower for item in ("patient", "email", "phone", "document", "address")):
            sanitized[key] = "[REDACTED_METADATA]"
            flags.append("PHI_METADATA")
        elif isinstance(value, str):
            sanitized[key] = re.sub(r"<[^>]*>", "", value)[:1000]
        else:
            sanitized[key] = value
    return sanitized
