from .types import ProductionSafetyConfig


def is_dry_run(config: ProductionSafetyConfig) -> bool:
    return config.dry_run or not config.ai_runtime_enabled
