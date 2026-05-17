from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ProductionLayer = Literal[
    "semantic_memory",
    "medical_vision",
    "provider_router",
    "human_review",
    "clinical_confidence",
    "observability",
    "production_safety",
]


@dataclass(slots=True)
class ProductionSafetyConfig:
    ai_runtime_enabled: bool
    shadow_mode: bool
    dry_run: bool
    kill_switch: bool
    safe_fallback: bool
    blocking_enabled: bool
    enabled_layers: list[ProductionLayer]
    disabled_layers: list[ProductionLayer]
    external_calls_allowed: bool
    phi_allowed: bool
    created_at: str


@dataclass(slots=True)
class RuntimeGuardResult:
    allowed: bool
    blocked_reason: list[str]
    active_flags: dict[str, bool]
    disabled_layers: list[ProductionLayer]
    safe_fallback_required: bool
    dry_run: bool
    shadow_mode: bool
    audit_ref: str
    created_at: str


@dataclass(slots=True)
class HealthCheckResult:
    layer: ProductionLayer
    status: Literal["healthy", "disabled", "shadow", "dry_run", "blocked", "warning"]
    enabled: bool
    shadow_mode: bool
    degraded: bool
    errors: list[str]
    warnings: list[str]
    checked_at: str


@dataclass(slots=True)
class StartupValidationResult:
    ok: bool
    errors: list[str]
    warnings: list[str]
    guard: RuntimeGuardResult
    health: list[HealthCheckResult]
    created_at: str


@dataclass(slots=True)
class EnvValidationResult:
    ok: bool
    missing_flags: list[str]
    dangerous_flags: list[str]
    warnings: list[str]
    checked_at: str
