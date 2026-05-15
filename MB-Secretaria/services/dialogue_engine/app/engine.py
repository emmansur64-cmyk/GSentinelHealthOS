from __future__ import annotations

from dataclasses import dataclass

from services.dialogue_engine.app.intent_classifier import RuleBasedIntentClassifier
from services.dialogue_engine.app.policies import DialoguePolicyEngine
from services.dialogue_engine.app.schemas import DialogueAction, DialogueRequest
from services.dialogue_engine.app.state_manager import InMemoryStateManager


class DialogueEngineError(RuntimeError):
    def __init__(self, code: str, message: str, status_code: int = 500, category: str = "dialogue") -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.category = category


@dataclass(slots=True)
class DialogueEngine:
    state_manager: InMemoryStateManager
    classifier: RuleBasedIntentClassifier
    policy_engine: DialoguePolicyEngine

    def process(self, payload: DialogueRequest) -> DialogueAction:
        try:
            intent = self.classifier.classify(payload.message)
            extracted_symptoms, symptom_details = self.classifier.extract_entities(payload.message)

            risk_level = payload.decision_output.risk_level if payload.decision_output else None

            self.state_manager.append_message(
                session_id=payload.session_id,
                role="user",
                message=payload.message,
                metadata={"intent_candidate": intent},
            )

            state = self.state_manager.update_state(
                session_id=payload.session_id,
                extracted_symptoms=extracted_symptoms,
                symptom_details=symptom_details,
                risk_level=risk_level,
            )

            policy = self.policy_engine.evaluate(
                intent=intent,
                state=state,
                decision_risk_level=risk_level,
            )

            context_updates = {
                "symptoms": state["symptoms"],
                "symptom_details": state["symptom_details"],
                "last_risk_level": state["last_risk_level"],
                "history_size": len(state["message_history"]),
            }

            action = DialogueAction.model_validate(
                {
                    "intent": intent,
                    "next_step": policy.next_step,
                    "required_fields": policy.required_fields,
                    "context_updates": context_updates,
                    "flags": policy.flags,
                }
            )

            self.state_manager.append_message(
                session_id=payload.session_id,
                role="system",
                message="dialogue_action_generated",
                metadata={
                    "intent": action.intent,
                    "next_step": action.next_step,
                    "flags": action.flags,
                },
            )

            return action
        except DialogueEngineError:
            raise
        except Exception as exc:  # pragma: no cover
            raise DialogueEngineError(
                code="dialogue_processing_failed",
                message="Failed to process dialogue request.",
                status_code=500,
                category="dialogue",
            ) from exc
