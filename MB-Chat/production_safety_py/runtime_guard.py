from datetime import UTC, datetime
from collections.abc import Mapping

from .global_feature_flags import read_flag
from .kill_switch import is_kill_switch_active
from .types import ProductionLayer, ProductionSafetyConfig, RuntimeGuardResult

LAYER_FLAG_MAP: dict[ProductionLayer, str] = {
    "semantic_memory": "SEMANTIC_MEMORY_ENABLED",
    "medical_vision": "MEDICAL_VISION_ENABLED",
    "provider_router": "LLM_PROVIDER_ROUTER_ENABLED",
    "human_review": "HUMAN_REVIEW_ENABLED",
    "clinical_confidence": "CLINICAL_CONFIDENCE_ENABLED",
    "observability": "OBSERVABILITY_ENABLED",
    "production_safety": "AI_RUNTIME_ENABLED",
}


def load_production_safety_config(env: Mapping[str, str]) -> ProductionSafetyConfig:
    layers = list(LAYER_FLAG_MAP.keys())
    enabled_layers = [layer for layer in layers if read_flag(env, LAYER_FLAG_MAP[layer], "false")]
    return ProductionSafetyConfig(
        ai_runtime_enabled=read_flag(env, "AI_RUNTIME_ENABLED", "false"),
        shadow_mode=read_flag(env, "AI_RUNTIME_SHADOW_MODE", "true"),
        dry_run=read_flag(env, "AI_RUNTIME_DRY_RUN", "true"),
        kill_switch=read_flag(env, "AI_RUNTIME_KILL_SWITCH", "true"),
        safe_fallback=read_flag(env, "AI_RUNTIME_SAFE_FALLBACK", "true"),
        blocking_enabled=read_flag(env, "AI_RUNTIME_BLOCKING_ENABLED", "false"),
        enabled_layers=enabled_layers,
        disabled_layers=[layer for layer in layers if layer not in enabled_layers],
        external_calls_allowed=read_flag(env, "AI_RUNTIME_EXTERNAL_CALLS_ALLOWED", "false"),
        phi_allowed=read_flag(env, "AI_RUNTIME_PHI_ALLOWED", "false"),
        created_at=datetime.now(UTC).isoformat(),
    )


def evaluate_runtime_guard(config: ProductionSafetyConfig) -> RuntimeGuardResult:
    blocked: list[str] = []
    if is_kill_switch_active(config):
        blocked.append("ai_runtime_kill_switch_or_disabled")
    if config.blocking_enabled and "human_review" not in config.enabled_layers:
        blocked.append("blocking_requires_human_review")
    if config.external_calls_allowed and not config.phi_allowed:
        blocked.append("external_calls_require_phi_policy")
    return RuntimeGuardResult(
        allowed=not blocked and config.ai_runtime_enabled and not config.kill_switch,
        blocked_reason=blocked,
        active_flags={
            "AI_RUNTIME_ENABLED": config.ai_runtime_enabled,
            "AI_RUNTIME_SHADOW_MODE": config.shadow_mode,
            "AI_RUNTIME_DRY_RUN": config.dry_run,
            "AI_RUNTIME_KILL_SWITCH": config.kill_switch,
            "AI_RUNTIME_SAFE_FALLBACK": config.safe_fallback,
            "AI_RUNTIME_BLOCKING_ENABLED": config.blocking_enabled,
        },
        disabled_layers=config.disabled_layers,
        safe_fallback_required=(not config.ai_runtime_enabled) or config.kill_switch or config.safe_fallback,
        dry_run=config.dry_run,
        shadow_mode=config.shadow_mode,
        audit_ref=f"production-safety:{config.created_at}",
        created_at=datetime.now(UTC).isoformat(),
    )
