from collections.abc import Mapping

GLOBAL_AI_FLAGS_DEFAULTS: dict[str, str] = {
    "AI_RUNTIME_ENABLED": "false",
    "AI_RUNTIME_SHADOW_MODE": "true",
    "AI_RUNTIME_DRY_RUN": "true",
    "AI_RUNTIME_KILL_SWITCH": "true",
    "AI_RUNTIME_SAFE_FALLBACK": "true",
    "AI_RUNTIME_BLOCKING_ENABLED": "false",
    "SEMANTIC_MEMORY_ENABLED": "false",
    "MEDICAL_VISION_ENABLED": "false",
    "LLM_PROVIDER_ROUTER_ENABLED": "false",
    "HUMAN_REVIEW_ENABLED": "false",
    "CLINICAL_CONFIDENCE_ENABLED": "false",
    "OBSERVABILITY_ENABLED": "false",
}

EXPECTED_GLOBAL_AI_FLAGS = tuple(GLOBAL_AI_FLAGS_DEFAULTS.keys())


def read_flag(env: Mapping[str, str], name: str, fallback: str = "false") -> bool:
    return str(env.get(name, fallback)).strip().lower() == "true"
