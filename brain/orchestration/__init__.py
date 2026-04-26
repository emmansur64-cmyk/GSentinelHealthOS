"""Paquete de orquestación central de GSentinelH.

Expone el IntelligentOrchestrator y sus dependencias para uso
desde la FastAPI app y el worker Redis.
"""

from brain.orchestration.clients import (
    DecisionClient,
    DialogueClient,
    InferenceClient,
    NLGClient,
    ServiceError,
)
from brain.orchestration.orchestrator import IntelligentOrchestrator
from brain.orchestration.session_manager import OrchestratorSessionManager

__all__ = [
    "DecisionClient",
    "DialogueClient",
    "InferenceClient",
    "NLGClient",
    "ServiceError",
    "IntelligentOrchestrator",
    "OrchestratorSessionManager",
]
