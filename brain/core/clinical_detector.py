"""Heurística simple para detectar casos clínicos estructurados."""

from __future__ import annotations


def is_clinical_case(text: str) -> bool:
    """Detecta si el texto parece un caso clínico estructurado."""
    if not isinstance(text, str):
        return False

    keywords = [
        "paciente",
        "diagnóstico",
        "creatinina",
        "ck",
        "tratamiento",
        "evolución",
        "síntomas",
        "analítica",
    ]

    lowered_text = text.lower()
    score = sum(1 for keyword in keywords if keyword in lowered_text)

    if len(text) > 300 and score >= 3:
        return True

    return False
