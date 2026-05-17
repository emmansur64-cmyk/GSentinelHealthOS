from datetime import UTC, datetime
from collections.abc import Mapping

from .global_feature_flags import EXPECTED_GLOBAL_AI_FLAGS, GLOBAL_AI_FLAGS_DEFAULTS, read_flag
from .types import EnvValidationResult


def validate_production_env(env: Mapping[str, str]) -> EnvValidationResult:
    missing = [flag for flag in EXPECTED_GLOBAL_AI_FLAGS if flag not in env]
    dangerous: list[str] = []
    warnings: list[str] = []
    if read_flag(env, "AI_RUNTIME_ENABLED", GLOBAL_AI_FLAGS_DEFAULTS["AI_RUNTIME_ENABLED"]) and not read_flag(env, "AI_RUNTIME_KILL_SWITCH", "true"):
        dangerous.append("ai_runtime_enabled_without_kill_switch")
    if read_flag(env, "MEDICAL_VISION_ENABLED", "false") and not read_flag(env, "HUMAN_REVIEW_ENABLED", "false"):
        dangerous.append("medical_vision_without_human_review")
    if read_flag(env, "CLINICAL_CONFIDENCE_BLOCKING_ENABLED", "false") and not read_flag(env, "HUMAN_REVIEW_ENABLED", "false"):
        dangerous.append("confidence_blocking_without_review")
    if read_flag(env, "OBSERVABILITY_EXTERNAL_EXPORT_ENABLED", "false") and read_flag(env, "OBSERVABILITY_PHI_ALLOWED", "false"):
        dangerous.append("observability_export_with_phi_allowed")
    if missing:
        warnings.append("expected_flags_missing_but_defaults_are_safe")
    return EnvValidationResult(not dangerous, missing, dangerous, warnings, datetime.now(UTC).isoformat())
