from __future__ import annotations

import json
from typing import Any


def parse_structured_json(raw: str) -> dict[str, Any]:
    try:
        return {"ok": True, "value": json.loads(raw)}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def validate_structured_object(value: Any, required_keys: list[str] | None = None) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {"ok": False, "error": "structured_output_not_object"}
    missing = [key for key in (required_keys or []) if key not in value]
    if missing:
        return {"ok": False, "error": "missing_keys:" + ",".join(missing)}
    return {"ok": True, "value": value}
