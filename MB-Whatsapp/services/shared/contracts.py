from __future__ import annotations

from typing import Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field


RiskLevel = Literal["low", "medium", "high"]


class ModelInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    source_type: Literal["text", "image"]
    modality: Literal["TEXT", "XRAY", "CT", "MRI"]
    text: str | None = None
    image_bytes: int | None = Field(default=None, ge=1)
    image_width: int | None = Field(default=None, ge=1)
    image_height: int | None = Field(default=None, ge=1)
    image_format: Literal["jpeg", "png", "bmp", "gif", "tiff"] | None = None


class ModelOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    model_name: str
    model_version: str
    risk_level: RiskLevel
    finding_code: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    probabilities: dict[RiskLevel, float]
    recommendation_code: str
    features_used: dict[str, float]


class DecisionInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    model_output: ModelOutput
    patient_context: dict[str, Any] = Field(default_factory=dict)


class DecisionOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    risk_level: RiskLevel
    clinical_flag: Literal["routine", "priority", "urgent"]
    requires_medical_evaluation: bool
    triage_level: Literal["green", "yellow", "red"]
    confidence_band: Literal["low", "medium", "high"]
    explanations: list[str]


class NLGInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    decision_output: DecisionOutput
    model_output: ModelOutput
    patient_context: dict[str, Any] = Field(default_factory=dict)


class NLGOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    text: str
    style: Literal["technical", "clinical"]
    variants_used: list[str]
    disclaimers: list[str]


class GatewayTextInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    input_type: Literal["text"] = "text"
    modality: Literal["TEXT", "XRAY", "CT", "MRI"] = "TEXT"
    text: str = Field(..., min_length=1, max_length=12000)
    patient_context: dict[str, Any] = Field(default_factory=dict)


class GatewayImageInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    input_type: Literal["image"] = "image"
    modality: Literal["XRAY", "CT", "MRI"] = "XRAY"
    image_base64: str = Field(..., min_length=24)
    patient_context: dict[str, Any] = Field(default_factory=dict)


AnalyzeRequest = Union[GatewayTextInput, GatewayImageInput]


class AnalyzeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    status: Literal["accepted"]
    pipeline: dict[str, Any]
    model_output: ModelOutput
    decision_output: DecisionOutput
    nlg_output: NLGOutput
    fallback_used: bool = False


class AsyncAnalyzeAccepted(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    status: Literal["accepted"]
    mode: Literal["async_queue"]
    job_id: str
    poll_url: str


class AsyncAnalyzePending(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    status: Literal["pending"]
    mode: Literal["async_queue"]
    job_id: str


class AsyncAnalyzeResult(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    status: Literal["completed"]
    mode: Literal["async_queue"]
    job_id: str
    result: AnalyzeResponse
