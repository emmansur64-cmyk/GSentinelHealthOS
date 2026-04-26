from __future__ import annotations

import hashlib
from dataclasses import dataclass

from services.shared.contracts import DecisionOutput, ModelOutput, NLGOutput


@dataclass(frozen=True)
class NLGRules:
    lead_by_risk: dict[str, list[str]]
    condition_clauses: dict[str, list[str]]
    action_clauses: dict[str, list[str]]


class RuleBasedNLGEngine:
    def __init__(self) -> None:
        self._rules = NLGRules(
            lead_by_risk={
                "high": [
                    "Se identifica un patron clinico de alto riesgo con potencial compromiso del paciente.",
                    "El analisis integra hallazgos compatibles con un escenario de riesgo elevado.",
                ],
                "medium": [
                    "Se observa un perfil clinico de riesgo intermedio que requiere evaluacion prioritaria.",
                    "La salida sugiere un riesgo moderado que amerita validacion medica dirigida.",
                ],
                "low": [
                    "No se detectan indicadores criticos en esta evaluacion automatizada.",
                    "El resultado muestra un perfil de bajo riesgo sin signos de alarma mayores.",
                ],
            },
            condition_clauses={
                "pneumonia_possible": [
                    "Los hallazgos son compatibles con posible proceso infeccioso pulmonar.",
                    "Existe evidencia indirecta de probable compromiso respiratorio infeccioso.",
                ],
                "fracture_possible": [
                    "El patron es sugestivo de probable lesion o fractura osea.",
                    "Se aprecia una configuracion compatible con dano oseo potencial.",
                ],
                "no_critical_imaging_pattern": [
                    "La imagen no muestra hallazgos criticos evidentes.",
                    "No se identifican alteraciones mayores en la evaluacion actual.",
                ],
            },
            action_clauses={
                "urgent": [
                    "Se recomienda valoracion medica urgente y priorizar confirmacion diagnostica.",
                    "Debe activarse circuito de atencion urgente para confirmacion y manejo.",
                ],
                "priority": [
                    "Se sugiere consulta prioritaria con seguimiento estrecho en corto plazo.",
                    "Es pertinente programar revision clinica prioritaria con pruebas complementarias.",
                ],
                "routine": [
                    "Se indica seguimiento rutinario, con reevaluacion si aparecen nuevos sintomas.",
                    "Puede mantenerse monitorizacion habitual y control clinico evolutivo.",
                ],
            },
        )

    def generate(
        self,
        decision_output: DecisionOutput,
        model_output: ModelOutput,
        patient_context: dict[str, object] | None = None,
    ) -> NLGOutput:
        patient_context = patient_context or {}

        lead = self._select(
            options=self._rules.lead_by_risk[decision_output.risk_level],
            key=f"lead:{decision_output.risk_level}:{model_output.model_version}",
        )

        condition_options = self._rules.condition_clauses.get(
            decision_output.suspected_condition,
            ["Se requiere correlacion clinica adicional para definir el significado de los hallazgos."],
        )
        condition = self._select(
            options=condition_options,
            key=f"condition:{decision_output.suspected_condition}:{model_output.finding_code}",
        )

        urgency_key = "routine"
        if decision_output.clinical_flag == "urgent":
            urgency_key = "urgent"
        elif decision_output.clinical_flag == "priority":
            urgency_key = "priority"

        action = self._select(
            options=self._rules.action_clauses[urgency_key],
            key=f"action:{urgency_key}:{decision_output.action_plan}",
        )

        tests = ""
        if decision_output.recommended_tests:
            tests = (
                " Pruebas sugeridas: "
                + ", ".join(decision_output.recommended_tests)
                + "."
            )

        red_flags = ""
        if decision_output.red_flags:
            red_flags = (
                " Factores de alerta detectados: "
                + ", ".join(decision_output.red_flags)
                + "."
            )

        text = " ".join(
            [
                lead,
                condition,
                action,
                f"Nivel de confianza del modelo: {model_output.confidence:.2f}.",
                red_flags.strip(),
                tests.strip(),
            ]
        ).strip()

        text = " ".join(text.split())

        return NLGOutput(
            text=text,
            style="technical",
            variants_used=[lead, condition, action],
            disclaimers=[
                "Salida automatizada de apoyo clinico; no reemplaza criterio medico.",
                "Requiere correlacion con historia clinica, examen fisico y estudios complementarios.",
            ],
        )

    @staticmethod
    def _select(options: list[str], key: str) -> str:
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        index = int(digest[:8], 16) % len(options)
        return options[index]
