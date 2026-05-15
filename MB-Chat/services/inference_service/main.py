from __future__ import annotations

from services.inference_service.app.main import app
from services.inference_service.app.service import get_inference_engine
from services.shared.contracts import ModelInput, ModelOutput


def infer(payload: ModelInput) -> ModelOutput:
    output, _ = get_inference_engine().predict(payload)
    return output


__all__ = ["app", "infer"]
