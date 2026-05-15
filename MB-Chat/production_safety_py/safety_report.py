from collections.abc import Mapping
from datetime import UTC, datetime

from .rollback_registry import build_rollback_registry
from .startup_validator import validate_production_safety_startup


def build_production_safety_report(env: Mapping[str, str]) -> dict[str, object]:
    startup = validate_production_safety_startup(env)
    return {
        "status": "safe_defaults" if startup.ok else "unsafe_flags_detected",
        "startup": startup,
        "rollback_registry": build_rollback_registry(),
        "generated_at": datetime.now(UTC).isoformat(),
    }
