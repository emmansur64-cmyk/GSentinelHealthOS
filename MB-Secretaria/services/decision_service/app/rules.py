from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Iterable

from services.decision_service.app.schemas import ConfidenceBand, ModelOutput, TriageLevel


@dataclass(slots=True)
class DecisionState:
    clinical_flag: str = "routine"
    requires_medical_evaluation: bool = False
    triage_level: TriageLevel = "green"
    confidence_band: ConfidenceBand = "medium"
    explanations: list[str] = field(default_factory=list)


Rule = Callable[[ModelOutput, DecisionState], None]


def _add_explanation(state: DecisionState, explanation: str) -> None:
    if explanation not in state.explanations:
        state.explanations.append(explanation)


def rule_risk_level(model_output: ModelOutput, state: DecisionState) -> None:
    if model_output.risk_level == "high":
        state.clinical_flag = "urgent"
        state.requires_medical_evaluation = True
        state.triage_level = "red"
        _add_explanation(state, "high_risk_detected")
        return

    if model_output.risk_level == "medium":
        state.clinical_flag = "priority"
        state.requires_medical_evaluation = True
        state.triage_level = "yellow"
        _add_explanation(state, "moderate_risk_detected")
        return

    state.clinical_flag = "routine"
    state.requires_medical_evaluation = False
    state.triage_level = "green"
    _add_explanation(state, "low_risk_detected")


def rule_low_confidence(model_output: ModelOutput, state: DecisionState) -> None:
    if model_output.confidence < 0.4:
        state.confidence_band = "low"
        _add_explanation(state, "low_model_confidence")
        return
    if model_output.confidence < 0.75:
        state.confidence_band = "medium"
        return
    state.confidence_band = "high"


def rule_high_probability_peak(model_output: ModelOutput, state: DecisionState) -> None:
    if model_output.probabilities.get("high", 0.0) > 0.7:
        _add_explanation(state, "high_probability_peak")


def rule_multi_factor_risk(model_output: ModelOutput, state: DecisionState) -> None:
    positive_factors = sum(1 for value in model_output.features_used.values() if value > 0)
    if positive_factors >= 3:
        _add_explanation(state, "multi_factor_risk")


def rule_critical_signal(model_output: ModelOutput, state: DecisionState) -> None:
    critical_tokens = ("critical", "severe", "urgent")
    finding = model_output.finding_code.lower()
    recommendation = model_output.recommendation_code.lower()
    if any(token in finding for token in critical_tokens) or any(token in recommendation for token in critical_tokens):
        _add_explanation(state, "critical_symptoms_present")
        if state.triage_level != "red":
            state.triage_level = "red"
        if state.clinical_flag != "urgent":
            state.clinical_flag = "urgent"
        state.requires_medical_evaluation = True


def default_rules() -> Iterable[Rule]:
    return (
        rule_risk_level,
        rule_low_confidence,
        rule_high_probability_peak,
        rule_multi_factor_risk,
        rule_critical_signal,
    )


__all__ = ["DecisionState", "Rule", "default_rules"]
