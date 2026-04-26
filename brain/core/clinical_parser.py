"""Parser simple para convertir texto clínico en datos estructurados."""

from __future__ import annotations

import re
from typing import Any, Dict, Optional


def extract_number(text: str, marker: str) -> Optional[float]:
    """Extrae el primer valor numérico cercano a un marcador clínico."""
    if not isinstance(text, str) or not isinstance(marker, str):
        return None

    pattern = re.compile(
        rf"{re.escape(marker)}\s*[:=]?\s*(\d+(?:[.,]\d+)?)",
        re.IGNORECASE,
    )
    match = pattern.search(text)
    if match is None:
        return None

    raw_value = match.group(1).replace(",", ".")
    try:
        return float(raw_value)
    except ValueError:
        return None


def parse_case(text: str) -> Dict[str, Any]:
    """Convierte texto clínico libre en una estructura simple y usable."""
    if not isinstance(text, str):
        return {"symptoms": []}

    lowered_text = text.lower()
    data: Dict[str, Any] = {"symptoms": []}

    # sintomas
    if "dolor muscular" in lowered_text:
        data["symptoms"].append("muscle_pain")

    if "orina oscura" in lowered_text or "cola" in lowered_text:
        data["symptoms"].append("myoglobinuria")

    if "debilidad" in lowered_text:
        data["symptoms"].append("weakness")

    # laboratorio
    if "ck" in lowered_text:
        data["ck"] = extract_number(text, "ck")

    if "creatinina" in lowered_text:
        data["creatinine"] = extract_number(text, "creatinina")

    if "potasio" in lowered_text:
        data["potassium"] = extract_number(text, "potasio")

    # contexto
    if "crossfit" in lowered_text:
        data["trigger"] = "exertion"

    return data
