from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from time import time
from typing import Any


_MAX_HISTORY = 100


@dataclass(slots=True)
class SessionState:
    session_id: str
    symptoms: set[str] = field(default_factory=set)
    message_history: list[dict[str, Any]] = field(default_factory=list)
    last_risk_level: str | None = None
    symptom_details: dict[str, str] = field(default_factory=dict)
    updated_at: float = field(default_factory=time)


class InMemoryStateManager:
    def __init__(self) -> None:
        self._lock = RLock()
        self._sessions: dict[str, SessionState] = {}

    def _get_or_create_unlocked(self, session_id: str) -> SessionState:
        state = self._sessions.get(session_id)
        if state is None:
            state = SessionState(session_id=session_id)
            self._sessions[session_id] = state
        return state

    def append_message(self, session_id: str, role: str, message: str, metadata: dict[str, Any] | None = None) -> None:
        with self._lock:
            state = self._get_or_create_unlocked(session_id)
            event = {
                "role": role,
                "message": message,
                "metadata": metadata or {},
                "ts": int(time()),
            }
            state.message_history.append(event)
            if len(state.message_history) > _MAX_HISTORY:
                state.message_history = state.message_history[-_MAX_HISTORY:]
            state.updated_at = time()

    def update_state(
        self,
        session_id: str,
        extracted_symptoms: set[str] | None = None,
        symptom_details: dict[str, str] | None = None,
        risk_level: str | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            state = self._get_or_create_unlocked(session_id)

            if extracted_symptoms:
                state.symptoms.update(extracted_symptoms)
            if symptom_details:
                state.symptom_details.update(symptom_details)
            if risk_level:
                state.last_risk_level = risk_level

            state.updated_at = time()
            return self._snapshot_unlocked(state)

    def get_state(self, session_id: str) -> dict[str, Any]:
        with self._lock:
            state = self._get_or_create_unlocked(session_id)
            return self._snapshot_unlocked(state)

    def _snapshot_unlocked(self, state: SessionState) -> dict[str, Any]:
        return {
            "session_id": state.session_id,
            "symptoms": sorted(state.symptoms),
            "message_history": list(state.message_history),
            "last_risk_level": state.last_risk_level,
            "symptom_details": dict(state.symptom_details),
            "updated_at": int(state.updated_at),
        }
