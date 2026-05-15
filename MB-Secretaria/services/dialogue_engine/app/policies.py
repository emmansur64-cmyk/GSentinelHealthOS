from __future__ import annotations

from dataclasses import dataclass, field

from services.dialogue_engine.app.schemas import IntentType, NextStep


_REQUIRED_SYMPTOM_FIELDS = ("duration", "intensity")


@dataclass(slots=True)
class PolicyResult:
    next_step: NextStep
    required_fields: list[str] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)


class DialoguePolicyEngine:
    def evaluate(
        self,
        intent: IntentType,
        state: dict,
        decision_risk_level: str | None,
    ) -> PolicyResult:
        effective_risk = decision_risk_level or state.get("last_risk_level")
        symptom_details = state.get("symptom_details", {})
        missing_fields = [field for field in _REQUIRED_SYMPTOM_FIELDS if field not in symptom_details]

        if effective_risk == "high":
            flags = ["urgent_attention"]
            if missing_fields:
                flags.append("missing_clinical_details")
            return PolicyResult(
                next_step="prioritize_response",
                required_fields=missing_fields,
                flags=flags,
            )

        if intent == "symptom_report":
            if missing_fields:
                return PolicyResult(
                    next_step="request_more_info",
                    required_fields=missing_fields,
                    flags=["possible_risk"],
                )
            return PolicyResult(next_step="collect_symptoms", flags=["possible_risk"])

        if intent == "severity_question":
            if effective_risk in {"low", "medium", "high"}:
                return PolicyResult(next_step="explain_risk")
            return PolicyResult(
                next_step="request_more_info",
                required_fields=["symptoms"],
                flags=["risk_context_missing"],
            )

        if intent == "follow_up_question":
            if missing_fields:
                return PolicyResult(next_step="request_more_info", required_fields=missing_fields)
            return PolicyResult(next_step="acknowledge")

        if intent == "greeting":
            return PolicyResult(next_step="request_more_info", required_fields=["symptoms"])

        return PolicyResult(next_step="ask_clarification", flags=["intent_uncertain"])
