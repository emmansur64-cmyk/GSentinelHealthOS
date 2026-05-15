from __future__ import annotations

import logging
from time import perf_counter

from fastapi import APIRouter, Request

from services.dialogue_engine.app.engine import DialogueEngine
from services.dialogue_engine.app.intent_classifier import RuleBasedIntentClassifier
from services.dialogue_engine.app.policies import DialoguePolicyEngine
from services.dialogue_engine.app.schemas import DialogueAction, DialogueRequest, HealthResponse
from services.dialogue_engine.app.state_manager import InMemoryStateManager


logger = logging.getLogger("cerebro_ai_med.distributed.dialogue")
router = APIRouter()

_state_manager = InMemoryStateManager()
_classifier = RuleBasedIntentClassifier()
_policy_engine = DialoguePolicyEngine()
_engine = DialogueEngine(
    state_manager=_state_manager,
    classifier=_classifier,
    policy_engine=_policy_engine,
)


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


@router.post("/dialogue", response_model=DialogueAction)
def dialogue(payload: DialogueRequest, request: Request) -> DialogueAction:
    request_id = getattr(request.state, "request_id", "unknown")
    started = perf_counter()
    action = _engine.process(payload)
    latency_ms = (perf_counter() - started) * 1000.0

    logger.info(
        "dialogue_action_generated",
        extra={
            "request_id": request_id,
            "session_id": payload.session_id,
            "intent": action.intent,
            "next_step": action.next_step,
            "flags": action.flags,
            "latency_ms": round(latency_ms, 3),
        },
    )
    return action
