from __future__ import annotations

from types import SimpleNamespace

import pytest

from api.app.api.v1.endpoints.brain_decide import DecideRequest, brain_decide
from brain.app import OrchestrationRequest, orchestrate


class _DummyOrchestrator:
    def __init__(self) -> None:
        self.called = False

    async def handle_request(self, **kwargs):
        self.called = True
        return {
            "message": "ok",
            "session_id": "s1",
            "metadata": {
                "risk_level": "low",
                "triage_level": "none",
                "flags": [],
                "confidence": 1.0,
                "inference_cached": False,
                "turn_count": 1,
                "explanation_count": 0,
                "request_id": "r1",
                "services_called": ["orchestrator"],
                "latency_ms": 1,
                "context_type": None,
                "assistant_mode": "doctor_professional",
                "actor_role": "doctor",
                "triage_allowed": True,
            },
        }


@pytest.mark.asyncio
async def test_orchestrate_blocks_invalid_mode_before_orchestrator_call() -> None:
    dummy = _DummyOrchestrator()
    body = OrchestrationRequest(
        user_input="hola",
        assistant_mode="invalid_mode",
        actor_role="doctor",
    )

    response = await orchestrate(body=body, orchestrator=dummy)

    assert dummy.called is False
    assert "contract_validation_blocked" in response.metadata.flags
    assert response.metadata.confidence == 0.0


@pytest.mark.asyncio
async def test_brain_decide_blocks_invalid_mode_before_nlu(monkeypatch: pytest.MonkeyPatch) -> None:
    called = {"nlu": False}

    async def _fake_analyze(*args, **kwargs):
        called["nlu"] = True
        return {"intent": "general_query", "entities": {}, "confidence": 0.1, "source": "rules"}

    monkeypatch.setattr("api.app.api.v1.endpoints.brain_decide.NLUEngine.analyze", _fake_analyze)

    payload = DecideRequest(
        role="DOCTOR",
        message="Necesito ayuda",
        assistant_mode="invalid_mode",
    )

    response = await brain_decide(payload=payload, auth=SimpleNamespace(service="brain"))

    assert response.action == "CONTRACT_BLOCKED"
    assert response.source == "CONTRACT_GUARD"
    assert response.confidence == 0.0
    assert called["nlu"] is False
