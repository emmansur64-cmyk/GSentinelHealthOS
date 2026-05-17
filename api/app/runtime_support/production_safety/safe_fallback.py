from typing import Any


def build_safe_fallback(reason: list[str], guard: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "fallback_required": True,
        "reason": reason,
        "action": "continue_existing_runtime_flow",
        "blocks_critical_apis": False,
        "dry_run": (guard or {}).get("dry_run", True),
        "shadow_mode": (guard or {}).get("shadow_mode", True),
    }
