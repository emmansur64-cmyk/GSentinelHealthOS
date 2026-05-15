from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Optional


ProviderName = Literal["groq", "openai", "gemini", "local", "future-medical"]
ProviderModality = Literal["text", "image", "audio", "multimodal", "unknown"]
ProviderRequestType = Literal["chat", "completion", "embedding", "vision", "multimodal", "healthcheck"]
ProviderSafetyLevel = Literal["public", "internal", "phi_possible", "phi_blocked"]


@dataclass
class ProviderRequest:
    trace_id: str
    tenant_id: str
    request_type: ProviderRequestType
    modality: ProviderModality
    metadata: dict[str, Any]
    safety_level: ProviderSafetyLevel
    timeout_ms: int
    doctor_id: Optional[str] = None
    patient_id: Optional[str] = None
    input_text: Optional[str] = None
    image_reference: Optional[str] = None
    structured_output_schema: Optional[dict[str, Any]] = None


@dataclass
class ProviderResponse:
    trace_id: str
    provider_name: str
    model_name: str
    latency_ms: int
    status: str
    content: str
    safety_flags: list[str]
    fallback_used: bool
    retry_count: int
    audit_ref: str
    created_at: str
    structured_output: Any = None
    confidence_score: Optional[float] = None


@dataclass(frozen=True)
class ProviderCapabilities:
    supports_text: bool
    supports_image: bool
    supports_multimodal: bool
    supports_structured_output: bool
    supports_streaming: bool
    supports_medical_mode: bool
    max_context_tokens: int
    safe_for_phi: bool


@dataclass(frozen=True)
class ProviderHealth:
    provider_name: ProviderName
    status: str
    latency_ms: int
    error_rate: float
    timeout_rate: float
    degraded_mode: bool
    checked_at: str


@dataclass(frozen=True)
class ProviderFlags:
    router_enabled: bool = False
    shadow_mode: bool = True
    fallback_enabled: bool = False
    healthcheck_enabled: bool = True
    structured_output_enabled: bool = False
    multimodal_enabled: bool = False
    external_image_enabled: bool = False
    phi_allowed: bool = False


@dataclass
class ProviderAdapter:
    provider_name: ProviderName
    model_name: str
    capabilities: ProviderCapabilities

    def complete(self, request: ProviderRequest) -> ProviderResponse:
        raise NotImplementedError

    def healthcheck(self) -> ProviderHealth:
        raise NotImplementedError
