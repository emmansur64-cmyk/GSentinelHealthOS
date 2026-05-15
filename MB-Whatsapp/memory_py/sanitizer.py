from __future__ import annotations

import re
from typing import Any


class MemorySanitizer:
    _email_re = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
    _phone_re = re.compile(r"(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)")
    _document_re = re.compile(
        r"\b(?:dni|documento|passport|pasaporte|ssn|cuit|cuil|rut)\s*[:#-]?\s*[A-Z0-9.\-]{5,}\b",
        re.IGNORECASE,
    )
    _secret_re = re.compile(
        r"\b(?:api[_-]?key|secret|token|password|passwd|authorization|bearer)\s*[:=]\s*[\"']?[^\"'\s,;]{8,}",
        re.IGNORECASE,
    )
    _jwt_re = re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b")
    _html_re = re.compile(r"<[^>]*>")
    _url_with_query_re = re.compile(r"\bhttps?://[^\s?#]+(?:\?[^\s]*)?", re.IGNORECASE)

    _sensitive_keys = (
        "password",
        "passwd",
        "secret",
        "token",
        "api_key",
        "apikey",
        "authorization",
        "cookie",
        "address",
        "street",
        "gps",
        "lat",
        "latitude",
        "lng",
        "longitude",
    )

    def sanitize_content(self, content: str) -> dict[str, Any]:
        if not content or not content.strip():
            return {
                "sanitized_content": "",
                "redactions": [],
                "blocked": True,
                "reason": "empty_content",
            }

        redactions: list[str] = []
        sanitized = content

        def replace(pattern: re.Pattern[str], marker: str, value: str) -> str:
            def _replacement(_: re.Match[str]) -> str:
                redactions.append(marker)
                return f"[REDACTED_{marker}]"

            return pattern.sub(_replacement, value)

        sanitized = replace(self._html_re, "HTML", sanitized)
        sanitized = replace(self._jwt_re, "JWT", sanitized)
        sanitized = replace(self._secret_re, "SECRET", sanitized)
        sanitized = replace(self._email_re, "EMAIL", sanitized)
        sanitized = replace(self._document_re, "DOCUMENT", sanitized)
        sanitized = replace(self._phone_re, "PHONE", sanitized)

        def strip_query(match: re.Match[str]) -> str:
            redactions.append("URL_QUERY")
            return match.group(0).split("?")[0]

        sanitized = self._url_with_query_re.sub(strip_query, sanitized)
        sanitized = re.sub(r"[\x00-\x1f\x7f]", " ", sanitized)
        sanitized = re.sub(r"\s+", " ", sanitized).strip()

        return {
            "sanitized_content": sanitized,
            "redactions": sorted(set(redactions)),
            "blocked": False,
        }

    def sanitize_metadata(self, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        sanitized: dict[str, Any] = {}
        for key, value in (metadata or {}).items():
            normalized = key.lower()
            if any(sensitive in normalized for sensitive in self._sensitive_keys):
                sanitized[key] = "[REDACTED_METADATA]"
            elif isinstance(value, str):
                sanitized[key] = self.sanitize_content(value)["sanitized_content"]
            else:
                sanitized[key] = value
        return sanitized
