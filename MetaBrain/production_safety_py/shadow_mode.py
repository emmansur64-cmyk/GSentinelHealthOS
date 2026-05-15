from .types import ProductionSafetyConfig


def is_shadow_mode(config: ProductionSafetyConfig) -> bool:
    return config.shadow_mode or not config.ai_runtime_enabled
