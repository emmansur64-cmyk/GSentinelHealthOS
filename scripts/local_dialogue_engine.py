"""Servicio local minimal de dialogue-engine para desarrollo.

Expone:
  - GET /health
  - POST /dialogue

Permite que el Brain deje de caer al fallback cuando no existe la imagen
sentinel-dialogue-engine en Docker.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

from fastapi import FastAPI
from pydantic import BaseModel, Field
import uvicorn


app = FastAPI(title="local-dialogue-engine", version="0.1.0")


class DialogueRequest(BaseModel):
    session_id: str = Field(min_length=1)
    user_input: str = Field(min_length=1)
    context: Dict[str, Any] = Field(default_factory=dict)


class DialogueResponse(BaseModel):
    intent: str
    entities: Dict[str, Any] = Field(default_factory=dict)
    next_step: str = "respond"
    requires_inference: bool = False
    confidence: float = 0.75
    explanation_count: int = 0
    context: Dict[str, Any] = Field(default_factory=dict)


@dataclass(frozen=True)
class IntentRule:
    intent: str
    keywords: List[str]
    confidence: float
    requires_inference: bool = False


_RULES: List[IntentRule] = [
    IntentRule("greeting", ["hola", "buen dia", "buenas", "que tal"], 0.95),
    IntentRule("symptom_report", ["dolor", "fiebre", "tos", "mareo", "nause"], 0.84, True),
    IntentRule("follow_up", ["y ahora", "siguiente", "continuo", "que hago"], 0.78),
]


def _detect_intent(text: str) -> tuple[str, float, bool]:
    normalized = text.lower().strip()
    for rule in _RULES:
        if any(keyword in normalized for keyword in rule.keywords):
            return rule.intent, rule.confidence, rule.requires_inference
    return "unknown", 0.55, False


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok", "service": "local-dialogue-engine"}


@app.post("/dialogue", response_model=DialogueResponse)
async def dialogue(payload: DialogueRequest) -> DialogueResponse:
    intent, confidence, requires_inference = _detect_intent(payload.user_input)
    output_context = dict(payload.context)
    output_context["last_user_input"] = payload.user_input
    output_context["detected_intent"] = intent

    return DialogueResponse(
        intent=intent,
        next_step="respond",
        requires_inference=requires_inference,
        confidence=confidence,
        context=output_context,
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8010)
