"""Módulo de routing conversacional con aislamiento de roles.

Exporta el validador de elegibilidad de triage y el router de roles.
"""
from brain.routing.triage_eligibility import TriageEligibilityValidator, TriageEligibilityResult
from brain.routing.role_router import RoleRouter, route_request

__all__ = [
    "TriageEligibilityValidator",
    "TriageEligibilityResult",
    "RoleRouter",
    "route_request",
]
