from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


RiskLevel = Literal["low", "medium", "high"]
ConfidenceBand = Literal["low", "medium", "high"]


class ModelInput(BaseModel):
    source_type: Literal["text", "image"]
    modality: Literal["TEXT", "XRAY", "CT", "MRI"]
    text: str | None = None
    image_bytes: int | None = Field(default=None, ge=1)
    image_width: int | None = Field(default=None, ge=1)
    image_height: int | None = Field(default=None, ge=1)
    image_format: Literal["jpeg", "png", "bmp", "gif", "tiff"] | None = None


class ModelOutput(BaseModel):
    model_name: str
    model_version: str
    risk_level: RiskLevel
    finding_code: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    probabilities: dict[RiskLevel, float]
    recommendation_code: str
    features_used: dict[str, float]


class DecisionOutput(BaseModel):
    """Schema de salida del motor de decisión clínica (v2 con ajustes finos)."""

    risk_level: str
    suspected_condition: str
    clinical_interpretation: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    action_plan: str
    urgency: str
    follow_up_hours: int
    red_flags: list[str]
    recommended_tests: list[str]
    model_evidence: dict

    # Ajustes finos v2
    rule_priority: int = Field(..., description="Prioridad de la regla disparada (1=máx. urgencia)")
    decision_score: float = Field(..., ge=0.0, le=1.0, description="Score compuesto riesgo+confianza+certeza")
    confidence_band: ConfidenceBand
    calibrated_confidence: float = Field(..., ge=0.0, le=1.0)
    uncertainty: float = Field(..., ge=0.0, le=1.0, description="Entropía normalizada del modelo")
    deferred: bool = Field(..., description="True si el sistema bloqueó la decisión por alta incertidumbre")
    defer_reason: str | None = None
    feature_warnings: list[str] = Field(default_factory=list)