"""Motor de decisión local para GSentinelH.

Implementa triage clínico rule-based sin dependencias externas.
"""
from brain.decision_engine import triage_engine
from brain.decision_engine.local_engine import run_decision, run_dialogue, run_inference

__all__ = ["triage_engine", "run_decision", "run_dialogue", "run_inference"]
