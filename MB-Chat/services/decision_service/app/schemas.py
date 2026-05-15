from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

from services.shared.contracts import ModelOutput, RiskLevel


DecisionFlag = Literal["routine", "priority", "urgent"]
TriageLevel = Literal["green", "yellow", "red"]
ConfidenceBand = Literal["low", "medium", "high"]
ErrorCategory = Literal["validation", "decision", "system"]


class DecisionOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    risk_level: RiskLevel
    clinical_flag: DecisionFlag
    requires_medical_evaluation: bool
    triage_level: TriageLevel
    confidence_band: ConfidenceBand
    explanations: list[str]


class ErrorDetail(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    code: str
    message: str
    category: ErrorCategory


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    error: ErrorDetail


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    status: Literal["ok"] = "ok"
    service: Literal["decision_service"] = "decision_service"


__all__ = [
    "ConfidenceBand",
    "DecisionOutput",
    "ErrorResponse",
    "HealthResponse",
    "ModelOutput",
    "TriageLevel",
]
