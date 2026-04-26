"""Template definitions for NLG: multiple variants per message type."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class MessageTemplate:
    """Estructura de mensaje con placeholders."""
    template: str
    name: str


class NLGTemplates:
    """Plantillas de texto natural con variabilidad real (no rígidas)."""

    def __init__(self) -> None:
        # Aperturas contextuales (según intent conversacional)
        self.opening_greetings: dict[str, list[MessageTemplate]] = {
            "symptom_report": [
                MessageTemplate(
                    template="Por lo que describes, {symptom_description}.",
                    name="opening_contextual_1",
                ),
                MessageTemplate(
                    template="Según los síntomas que mencionas ({symptom_description}), ",
                    name="opening_contextual_2",
                ),
                MessageTemplate(
                    template="Con la información disponible sobre {symptom_description}, ",
                    name="opening_contextual_3",
                ),
            ],
            "severity_question": [
                MessageTemplate(
                    template="Respecto a la gravedad de tu condición, ",
                    name="opening_severity_1",
                ),
                MessageTemplate(
                    template="En cuanto a la seriedad de lo que describes, ",
                    name="opening_severity_2",
                ),
            ],
            "follow_up": [
                MessageTemplate(
                    template="Continuando con el análisis, ",
                    name="opening_followup_1",
                ),
                MessageTemplate(
                    template="Considerando la información anterior, ",
                    name="opening_followup_2",
                ),
            ],
            "default": [
                MessageTemplate(
                    template="Con respecto a tu consulta, ",
                    name="opening_default",
                ),
            ],
        }

        # Frases de apertura por nivel de riesgo
        self.risk_introductions: dict[str, list[MessageTemplate]] = {
            "high": [
                MessageTemplate(
                    template="existe un riesgo elevado que requiere atención inmediata",
                    name="risk_intro_high_1",
                ),
                MessageTemplate(
                    template="se identifica una situación que podría ser importante y necesita evaluación urgente",
                    name="risk_intro_high_2",
                ),
                MessageTemplate(
                    template="los hallazgos sugieren una condición que requiere revisión médica pronta",
                    name="risk_intro_high_3",
                ),
            ],
            "medium": [
                MessageTemplate(
                    template="existe un riesgo moderado que necesita seguimiento",
                    name="risk_intro_medium_1",
                ),
                MessageTemplate(
                    template="se aprecia una situación que requiere evaluación prioritaria en corto plazo",
                    name="risk_intro_medium_2",
                ),
                MessageTemplate(
                    template="los hallazgos sugieren una condición que merece atención profesional",
                    name="risk_intro_medium_3",
                ),
            ],
            "low": [
                MessageTemplate(
                    template="los hallazgos son compatibles con un cuadro de bajo riesgo",
                    name="risk_intro_low_1",
                ),
                MessageTemplate(
                    template="no se identifican indicadores críticos en esta evaluación",
                    name="risk_intro_low_2",
                ),
                MessageTemplate(
                    template="el análisis muestra un perfil que no presenta signos de alarma mayores",
                    name="risk_intro_low_3",
                ),
            ],
        }

        # Interpretaciones clínicas
        self.clinical_interpretations: dict[str, list[MessageTemplate]] = {
            "possible_pneumonia": [
                MessageTemplate(
                    template="Los síntomas y hallazgos son compatibles con una posible infección pulmonar.",
                    name="interp_pneumonia_1",
                ),
                MessageTemplate(
                    template="Existe evidencia clínica de probable afección respiratoria infecciosa.",
                    name="interp_pneumonia_2",
                ),
                MessageTemplate(
                    template="La presentación sugiere un proceso infeccioso que afecta los pulmones.",
                    name="interp_pneumonia_3",
                ),
            ],
            "possible_fracture": [
                MessageTemplate(
                    template="Los hallazgos son sugestivos de una posible lesión o fractura ósea.",
                    name="interp_fracture_1",
                ),
                MessageTemplate(
                    template="Se aprecia una configuración compatible con daño estructural óseo.",
                    name="interp_fracture_2",
                ),
                MessageTemplate(
                    template="El patrón observado es consistente con una posible fractura.",
                    name="interp_fracture_3",
                ),
            ],
            "normal": [
                MessageTemplate(
                    template="La evaluación muestra un patrón dentro de lo esperado, sin hallazgos críticos.",
                    name="interp_normal_1",
                ),
                MessageTemplate(
                    template="No se identifican alteraciones mayores en los hallazgos actuales.",
                    name="interp_normal_2",
                ),
                MessageTemplate(
                    template="Los resultados son compatibles con una evaluación normal.",
                    name="interp_normal_3",
                ),
            ],
        }

        # Recomendaciones por nivel de urgencia
        self.action_recommendations: dict[str, list[MessageTemplate]] = {
            "urgent": [
                MessageTemplate(
                    template="Se recomienda búsqueda inmediata de evaluación médica profesional para confirmación diagnóstica y manejo.",
                    name="action_urgent_1",
                ),
                MessageTemplate(
                    template="Es prioritario acceder a una consulta urgente de médico o centro de salud para evaluación directa.",
                    name="action_urgent_2",
                ),
                MessageTemplate(
                    template="Deberías contactar de inmediato a un profesional médico para revisión clínica urgente.",
                    name="action_urgent_3",
                ),
            ],
            "priority": [
                MessageTemplate(
                    template="Se sugiere agendar una consulta prioritaria en corto plazo para evaluación y posibles estudios complementarios.",
                    name="action_priority_1",
                ),
                MessageTemplate(
                    template="Es recomendable programar una revisión clínica prioritaria en los próximos días.",
                    name="action_priority_2",
                ),
                MessageTemplate(
                    template="Se propone una evaluación profesional prioritaria con seguimiento en plazo breve.",
                    name="action_priority_3",
                ),
            ],
            "routine": [
                MessageTemplate(
                    template="Se indica seguimiento rutinario con reevaluación si aparecen nuevos síntomas.",
                    name="action_routine_1",
                ),
                MessageTemplate(
                    template="Puedes mantener monitización habitual y contactar al médico si los síntomas persisten o empeoran.",
                    name="action_routine_2",
                ),
                MessageTemplate(
                    template="Se recomienda control clínico regular y observación de cualquier cambio en tu estado.",
                    name="action_routine_3",
                ),
            ],
        }

        # Clausuras y disclaimers de seguridad
        self.safety_disclaimers: list[MessageTemplate] = [
            MessageTemplate(
                template="Esta evaluación es de carácter preliminar y requiere validación por profesional médico calificado.",
                name="disclaimer_preliminary",
            ),
            MessageTemplate(
                template="Cualquier diagnóstico debe confirmarse mediante una evaluación médica directa.",
                name="disclaimer_confirmation",
            ),
            MessageTemplate(
                template="La información aquí proporcionada no reemplaza la consulta médica profesional.",
                name="disclaimer_professional",
            ),
        ]

        # Conexiones para encadenar frases
        self.connectors: dict[str, list[str]] = {
            "causal": ["por lo que", "dado que", "debido a que", "en razón de"],
            "additive": ["además", "asimismo", "también", "igualmente"],
            "contrast": ["sin embargo", "por el contrario", "aun así", "no obstante"],
            "conclusion": ["en conclusión", "por lo tanto", "en síntesis", "resumiendo"],
        }

    def get_opening(self, intent: str = "default") -> str:
        """Seleccionar apertura según intent conversacional."""
        import random
        templates = self.opening_greetings.get(intent, self.opening_greetings["default"])
        return random.choice(templates).template

    def get_risk_introduction(self, risk_level: str) -> str:
        """Seleccionar introducción de riesgo."""
        import random
        templates = self.risk_introductions.get(risk_level, [])
        if not templates:
            return "existe un riesgo que requiere evaluación"
        return random.choice(templates).template

    def get_clinical_interpretation(self, interpretation_code: str) -> str:
        """Seleccionar interpretación clínica."""
        import random
        templates = self.clinical_interpretations.get(
            interpretation_code, self.clinical_interpretations.get("normal", [])
        )
        if not templates:
            return "Se requiere evaluación clínica adicional."
        return random.choice(templates).template

    def get_action_recommendation(self, urgency_level: str) -> str:
        """Seleccionar recomendación de acción."""
        import random
        templates = self.action_recommendations.get(
            urgency_level, self.action_recommendations.get("routine", [])
        )
        if not templates:
            return "Se recomienda seguimiento médico."
        return random.choice(templates).template

    def get_safety_disclaimer(self) -> str:
        """Obtener disclaimer de seguridad clínica."""
        import random
        return random.choice(self.safety_disclaimers).template

    def get_connector(self, connector_type: str = "additive") -> str:
        """Obtener conector para encadenar frases."""
        import random
        connectors = self.connectors.get(connector_type, self.connectors["additive"])
        return random.choice(connectors)
