from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from services.decision_service.app.rules import DecisionState, Rule, default_rules
from services.decision_service.app.schemas import DecisionOutput, ModelOutput


class DecisionEngineError(RuntimeError):
    def __init__(self, code: str, message: str, status_code: int = 500, category: str = "decision") -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.category = category


@dataclass(slots=True)
class DecisionEngine:
    rules: Iterable[Rule]

    def decide(self, model_output: ModelOutput) -> DecisionOutput:
        try:
            state = DecisionState()
            for rule in self.rules:
                rule(model_output, state)

            if not state.explanations:
                state.explanations.append("decision_generated")

            return DecisionOutput.model_validate(
                {
                    "risk_level": model_output.risk_level,
                    "clinical_flag": state.clinical_flag,
                    "requires_medical_evaluation": state.requires_medical_evaluation,
                    "triage_level": state.triage_level,
                    "confidence_band": state.confidence_band,
                    "explanations": state.explanations,
                }
            )
        except DecisionEngineError:
            raise
        except Exception as exc:  # pragma: no cover
            raise DecisionEngineError(
                code="decision_processing_failed",
                message="Failed to generate clinical decision.",
                status_code=500,
                category="decision",
            ) from exc


def get_default_engine() -> DecisionEngine:
    return DecisionEngine(rules=default_rules())


__all__ = ["DecisionEngine", "DecisionEngineError", "get_default_engine"]
