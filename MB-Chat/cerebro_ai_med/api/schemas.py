from __future__ import annotations

from datetime import datetime
from typing import Literal, Union

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    status: Literal["ok"]
    service: Literal["cerebro_ai_med"]
    version: str


class TextInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    input_type: Literal["text"] = "text"
    modality: Literal["TEXT", "XRAY", "CT", "MRI"] = "TEXT"
    text: str = Field(..., min_length=1)


class ImageInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    input_type: Literal["image"] = "image"
    modality: Literal["XRAY", "CT", "MRI"] = "XRAY"
    image_base64: str = Field(..., min_length=24)


class ImageFormInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    modality: Literal["XRAY", "CT", "MRI"] = "XRAY"


AnalyzeInput = Union[TextInput, ImageInput]


class TextSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    text_length: int = Field(..., ge=1)
    preview: str


class ImageSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    bytes: int = Field(..., ge=1)
    format: Literal["jpeg", "png", "bmp", "gif", "tiff"]
    width: int = Field(..., ge=1)
    height: int = Field(..., ge=1)


class InputInfo(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    type: Literal["text", "image"]
    modality: Literal["TEXT", "XRAY", "CT", "MRI"]
    summary: Union[TextSummary, ImageSummary]


class PipelineInfo(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    step: Literal["api_base"]
    next_step: Literal["models_baseline"]
    message: str


class ModelInference(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    model_name: str
    model_version: str
    risk_level: Literal["low", "medium", "high"]
    finding_code: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    probabilities: dict[Literal["low", "medium", "high"], float]
    recommendation_code: str
    features_used: dict[str, float]


class MedicalAuditInfo(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    no_definitive_diagnosis: Literal[True] = True
    risk_level: Literal["low", "medium", "high"]
    safe_recommendation: str
    requires_medical_evaluation: bool


class CerebroDecisionInfo(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    risk_level: Literal["low", "medium", "high", "unknown"]
    urgency: str
    action_plan: str
    deferred: bool
    decision_score: float = Field(..., ge=0.0, le=1.0)


class GroqDecisionInfo(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    enabled: bool
    risk_level: Literal["low", "medium", "high", "unknown"]
    narrative: str
    fallback_applied: bool
    stages_executed: list[str]


class JointDecisionInfo(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    final_risk_level: Literal["low", "medium", "high", "unknown"]
    consensus: Literal["aligned", "escalated_by_groq", "cerebro_primary"]
    final_action_plan: str
    final_urgency: str
    follow_up_hours: int = Field(..., ge=0)
    sources: list[Literal["cerebro_rules", "groq_pipeline"]]
    source_count: int = Field(..., ge=2)
    cerebro: CerebroDecisionInfo
    groq: GroqDecisionInfo
    details: dict[str, object]


class AnalyzeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    status: Literal["accepted"]
    timestamp_utc: datetime
    input: InputInfo
    pipeline: PipelineInfo
    inference: ModelInference
    joint_decision: JointDecisionInfo
    medical_audit: MedicalAuditInfo


class ErrorInfo(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    category: Literal["validation", "inference", "system"]
    code: str
    message: str


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    request_id: str
    error: ErrorInfo
    detail: str
