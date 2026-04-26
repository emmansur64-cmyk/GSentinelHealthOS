from __future__ import annotations

import asyncio

from brain.core.clinical_detector import is_clinical_case
from brain.core.clinical_parser import parse_case
from brain.core.decision_core import process_clinical_case


CLINICAL_TEXT = (
    "Paciente de 32 años con dolor muscular intenso, debilidad generalizada y orina oscura "
    "tras sesión de crossfit. Analítica con CK 12000, creatinina 1.9, potasio 5.8. "
    "Diagnóstico presuntivo, tratamiento inicial y evolución en observación. "
    "Paciente de 32 años con dolor muscular intenso, debilidad generalizada y orina oscura "
    "tras sesión de crossfit. Analítica con CK 12000, creatinina 1.9, potasio 5.8. "
    "Diagnóstico presuntivo, tratamiento inicial y evolución en observación."
)


def test_is_clinical_case_detects_structured_case() -> None:
    assert is_clinical_case(CLINICAL_TEXT) is True


def test_parse_case_extracts_structured_data() -> None:
    parsed = parse_case(CLINICAL_TEXT)

    assert parsed["symptoms"] == ["muscle_pain", "myoglobinuria", "weakness"]
    assert parsed["ck"] == 12000.0
    assert parsed["creatinine"] == 1.9
    assert parsed["potassium"] == 5.8
    assert parsed["trigger"] == "exertion"


def test_process_clinical_case_returns_high_risk_analysis() -> None:
    result = asyncio.run(process_clinical_case(CLINICAL_TEXT, {}))

    assert result["type"] == "clinical_analysis"
    assert result["triage_level"] == "naranja"
    assert result["risk"] >= 0.8
    assert result["triage"]["triage_level"] == "naranja"
    assert "analysis" in result and result["analysis"]
    assert "rabdomiolisis" in result["analysis"].lower()
    assert "hidratacion agresiva" in result["analysis"].lower()
