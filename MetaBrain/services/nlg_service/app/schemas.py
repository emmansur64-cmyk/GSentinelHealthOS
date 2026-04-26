"""Pydantic schemas for NLG service."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from services.shared.contracts import DecisionOutput, ModelOutput


class NLGGenerateRequest(BaseModel):
    """Request para POST /generate."""
    
    model_config = ConfigDict(extra="forbid", strict=True)
    
    dialogue_action: dict[str, Any] | None = Field(
        default=None,
        description="DialogueAction from dialogue-engine (intent, next_step, etc)"
    )
    decision_output: DecisionOutput = Field(
        description="DecisionOutput from decision-service"
    )
    model_output: ModelOutput = Field(
        description="ModelOutput from inference-service"
    )
    symptoms: list[str] = Field(
        default_factory=list,
        max_length=20,
        description="Síntomas reportados para enriquecer generación"
    )
    patient_context: dict[str, Any] = Field(
        default_factory=dict,
        description="Contexto adicional del paciente (opcional)"
    )
    conversation_history: list[dict[str, Any]] = Field(
        default_factory=list,
        max_length=200,
        description="Historial completo de la conversacion para NLG context-aware"
    )


class NLGGenerateResponse(BaseModel):
    """Response de POST /generate."""
    
    model_config = ConfigDict(extra="forbid", strict=True)
    
    message: str = Field(
        min_length=50,
        max_length=1500,
        description="Texto natural generado"
    )
    style: Literal["clinical", "conversational"] = Field(
        description="Estilo del lenguaje"
    )
    variants_used: list[str] = Field(
        description="Lista de variantes de template utilizadas"
    )
    disclaimers: list[str] = Field(
        description="Disclaimers de seguridad incluidos"
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Metadata compacta de auditoria y trazabilidad de la solicitud"
    )


class HealthResponse(BaseModel):
    """Response de GET /health."""
    
    model_config = ConfigDict(extra="forbid", strict=True)
    
    status: Literal["ok"] = "ok"
    service: str = "nlg-service"
    version: str = "1.0.0"


class ErrorResponse(BaseModel):
    """Response de error."""
    
    model_config = ConfigDict(extra="forbid", strict=True)
    
    error: dict[str, str] = Field(
        description="Error details"
    )


class LLMStatusResponse(BaseModel):
    """Internal diagnostics response for LLM integration mode."""

    model_config = ConfigDict(extra="forbid", strict=True)

    mode: Literal["groq", "deterministic"]
    groq_enabled: bool
    groq_sdk_available: bool
    api_key_configured: bool
    enabled_by_env: bool
    model: str
    temperature: float
    max_tokens: int
    rewriter_enabled: bool
    meta_rewriter: Literal["groq", "rule_based"]
    prompt_sources: dict[str, dict[str, object]]
    orchestrator_runtime: dict[str, Any]
