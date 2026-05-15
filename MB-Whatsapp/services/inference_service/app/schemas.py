from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from services.shared.contracts import ModelInput, ModelOutput


ErrorCategory = Literal["validation", "inference", "system"]


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
    model_loaded: bool
    model_version: str = Field(default="unknown")
