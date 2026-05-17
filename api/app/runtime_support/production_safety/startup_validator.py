from datetime import UTC, datetime
from collections.abc import Mapping

from .env_validator import validate_production_env
from .health_check import build_production_safety_health
from .runtime_guard import evaluate_runtime_guard, load_production_safety_config
from .types import StartupValidationResult


def validate_production_safety_startup(env: Mapping[str, str]) -> StartupValidationResult:
    config = load_production_safety_config(env)
    guard = evaluate_runtime_guard(config)
    env_validation = validate_production_env(env)
    return StartupValidationResult(
        ok=not env_validation.dangerous_flags,
        errors=list(env_validation.dangerous_flags),
        warnings=list(env_validation.warnings),
        guard=guard,
        health=build_production_safety_health(config),
        created_at=datetime.now(UTC).isoformat(),
    )
