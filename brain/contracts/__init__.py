"""Contratos formales del sistema conversacional clínico de GSentinelH.

Toda la lógica de routing, role isolation y gating de triage debe importar
los contratos desde este módulo. NO usar strings libres para assistant_mode
ni actor_role en el pipeline de decisión.
"""
from brain.contracts.routing import (
    ActorRole,
    AssistantMode,
    ClinicalCapabilities,
    ConversationalContract,
    RoutingDecision,
    TriageEligibilityState,
    build_contract,
    get_capabilities,
    SAFE_FALLBACK_RESPONSE,
)

__all__ = [
    "ActorRole",
    "AssistantMode",
    "ClinicalCapabilities",
    "ConversationalContract",
    "RoutingDecision",
    "TriageEligibilityState",
    "build_contract",
    "get_capabilities",
    "SAFE_FALLBACK_RESPONSE",
]
