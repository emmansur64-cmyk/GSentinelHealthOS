from datetime import UTC, datetime

from .types import HealthCheckResult, ProductionLayer, ProductionSafetyConfig

LAYERS: tuple[ProductionLayer, ...] = (
    "semantic_memory",
    "medical_vision",
    "provider_router",
    "human_review",
    "clinical_confidence",
    "observability",
    "production_safety",
)


def build_layer_health(layer: ProductionLayer, config: ProductionSafetyConfig) -> HealthCheckResult:
    enabled = layer in config.enabled_layers
    warnings: list[str] = []
    if enabled and config.kill_switch:
        warnings.append("enabled_layer_blocked_by_global_kill_switch")
    if enabled and config.dry_run:
        warnings.append("enabled_layer_would_run_dry_run_only")
    status = "disabled" if not enabled else "blocked" if config.kill_switch else "dry_run" if config.dry_run else "shadow" if config.shadow_mode else "warning"
    return HealthCheckResult(layer, status, enabled, config.shadow_mode, bool(warnings), [], warnings, datetime.now(UTC).isoformat())  # type: ignore[arg-type]


def build_production_safety_health(config: ProductionSafetyConfig) -> list[HealthCheckResult]:
    return [build_layer_health(layer, config) for layer in LAYERS]
