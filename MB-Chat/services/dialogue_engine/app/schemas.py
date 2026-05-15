from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from services.shared.contracts import DecisionOutput


IntentType = Literal[
    "symptom_report",
    "follow_up_question",
    "severity_question",
    "greeting",
    "unknown",
]

NextStep = Literal[
    "collect_symptoms",
    "request_more_info",
    "explain_risk",
    "prioritize_response",
    "ask_clarification",
    "acknowledge",
]

ErrorCategory = Literal["validation", "dialogue", "system"]


class DialogueRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    session_id: str = Field(..., min_length=3, max_length=128)
    message: str = Field(..., min_length=1, max_length=2000)
    decision_output: DecisionOutput | None = None

    @field_validator("session_id")
    @classmethod
    def validate_session_id(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("session_id cannot be empty")
        allowed = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.:")
        if any(ch not in allowed for ch in normalized):
            raise ValueError("session_id contains invalid characters")
        return normalized

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("message cannot be empty")
        return normalized


class DialogueAction(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    intent: IntentType
    next_step: NextStep
    required_fields: list[str] = Field(default_factory=list)
    context_updates: dict[str, Any] = Field(default_factory=dict)
    flags: list[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    status: Literal["ok"] = "ok"
    service: Literal["dialogue_engine"] = "dialogue_engine"


class ErrorDetail(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    code: str
    message: str
    category: ErrorCategory


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    error: ErrorDetail
