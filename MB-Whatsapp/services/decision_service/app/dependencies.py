from __future__ import annotations

import os
import secrets
from functools import lru_cache

from fastapi import Header, Request

from services.decision_service.app.engine import DecisionEngine, get_default_engine


INTERNAL_KEY_HEADER = "X-Internal-Key"


def get_request_id(request: Request) -> str:
    request_id = getattr(request.state, "request_id", "")
    if isinstance(request_id, str) and request_id:
        return request_id
    return "unknown"


def require_internal_key(x_internal_key: str | None = Header(default=None, alias=INTERNAL_KEY_HEADER)) -> None:
    expected_key = os.getenv("DECISION_INTERNAL_KEY", "").strip()
    if not expected_key:
        return
    if not x_internal_key or not secrets.compare_digest(x_internal_key, expected_key):
        from services.decision_service.app.engine import DecisionEngineError

        raise DecisionEngineError(
            code="unauthorized_internal_key",
            message="Invalid internal API key.",
            status_code=401,
            category="validation",
        )


@lru_cache(maxsize=1)
def get_decision_engine() -> DecisionEngine:
    return get_default_engine()


__all__ = ["get_decision_engine", "get_request_id", "require_internal_key"]
