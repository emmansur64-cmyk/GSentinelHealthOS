from .types import ProductionSafetyConfig


def is_kill_switch_active(config: ProductionSafetyConfig) -> bool:
    return config.kill_switch or not config.ai_runtime_enabled
