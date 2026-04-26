"""Utilidades de logging para minimizar exposicion de PII."""

from __future__ import annotations


def mask_phone(phone: str | None) -> str:
    """Convierte +5491122334455 en +54911****4455."""
    if not phone:
        return "****"

    trimmed = phone.strip()
    if len(trimmed) < 8:
        return "****"

    return f"{trimmed[:6]}****{trimmed[-4:]}"
