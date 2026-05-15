"""Generator: constructs final natural language text from plan."""

from __future__ import annotations

from dataclasses import dataclass

from services.nlg_service.app.lexicon import MedicalLexicon
from services.nlg_service.app.planner import MessagePlan
from services.nlg_service.app.templates import NLGTemplates
from services.shared.contracts import DecisionOutput, ModelOutput


@dataclass
class GeneratedMessage:
    """Mensaje generado con metadatos."""

    text: str
    variants_used: list[str]  # Lista de variantes seleccionadas
    sections: dict[str, str]  # Secciones generadas: {"opening": "...", "action": "..."}


class NLGGenerator:
    """
    Generador de texto natural sin LLM.

    Construye mensajes combinando:
    - Plantillas dinámicas (templates.py)
    - Mapeo semántico (lexicon.py)
    - Plan estructurado (planner.py)
    - Variación controlada (selección aleatoria + validación)
    """

    def __init__(self) -> None:
        self._templates = NLGTemplates()
        self._lexicon = MedicalLexicon()
        self._max_length = 1500  # Límite de caracteres para seguridad
        self._min_length = 50  # Mínimo para ser válido

    def generate(
        self,
        plan: MessagePlan,
        decision_output: DecisionOutput,
        model_output: ModelOutput,
        symptoms: list[str] | None = None,
        history_context: dict[str, object] | None = None,
    ) -> GeneratedMessage:
        """
        Generar texto natural completo.

        Args:
            plan: Plan de mensaje (estructura + variaciones)
            decision_output: Salida de decision-service
            model_output: Salida de inference-service
            symptoms: Lista de síntomas reportados

        Returns:
            GeneratedMessage con texto + metadatos
        """
        sections: dict[str, str] = {}
        variants_used: list[str] = []
        history_context = history_context or {}

        # Generar cada sección según el plan
        for section in plan.structure:
            if section == "opening":
                section_text = self._generate_opening(
                    intent=plan.variations_to_use.get(section, "default"),
                    symptoms=symptoms or [],
                    style_stage=plan.style_stage,
                )
                sections[section] = section_text
                variants_used.append(f"opening:{plan.variations_to_use.get(section, 'default')}")

            elif section == "risk_intro":
                risk_level = plan.variations_to_use.get(section, "medium")
                section_text = self._generate_risk_introduction(risk_level)
                sections[section] = section_text
                variants_used.append(f"risk_intro:{risk_level}")

            elif section == "clinical_interpretation":
                interp_type = plan.variations_to_use.get(section, "normal")
                section_text = self._generate_clinical_interpretation(
                    interp_type,
                    decision_output.explanations,
                    model_output.finding_code,
                )
                sections[section] = section_text
                variants_used.append(f"clinical_interpretation:{interp_type}")

            elif section in ["action", "action_urgent"]:
                urgency = plan.variations_to_use.get(section, "routine")
                section_text = self._generate_action_recommendation(
                    urgency=urgency,
                    tests=decision_output.recommended_tests if hasattr(decision_output, 'recommended_tests') else [],
                    emphasis=section == "action_urgent",
                )
                sections[section] = section_text
                variants_used.append(f"action:{urgency}")

            elif section == "disclaimer":
                section_text = self._generate_disclaimer()
                sections[section] = section_text
                variants_used.append("disclaimer:safety")

        # Ensamblar secciones con conectores
        full_text = self._assemble_sections(
            sections,
            plan.structure,
            plan.tone,
            plan.component_slots,
            plan.style_stage,
            int(history_context.get("history_size", 0)) if str(history_context.get("history_size", 0)).isdigit() else 0,
        )

        # Validar y sanitizar
        full_text = self._validate_and_sanitize(full_text)

        return GeneratedMessage(
            text=full_text,
            variants_used=variants_used,
            sections=sections,
        )

    def _generate_opening(self, intent: str, symptoms: list[str], style_stage: str) -> str:
        """Generar apertura contextual."""
        template = self._templates.get_opening(intent)

        # Reemplazar placeholders
        lexicon_style = "neutral"
        if style_stage == "formal":
            lexicon_style = "formal"
        elif style_stage == "directo":
            lexicon_style = "casual"
        symptom_description = self._lexicon.get_symptom_list(symptoms, style=lexicon_style)

        if "{symptom_description}" in template:
            return template.format(symptom_description=symptom_description)
        return template

    def _generate_risk_introduction(self, risk_level: str) -> str:
        """Generar introducción de riesgo."""
        return self._templates.get_risk_introduction(risk_level)

    def _generate_clinical_interpretation(
        self, interpretation_code: str, explanations: list[str], finding_code: str
    ) -> str:
        """Generar interpretación clínica."""
        base_interpretation = self._templates.get_clinical_interpretation(
            interpretation_code
        )

        # Enriquecer con explicaciones si existen
        if explanations:
            connector = self._templates.get_connector("additive")
            # Convertir explicación a forma más natural
            explanation_text = self._naturalize_explanation(explanations[0])
            return f"{base_interpretation} {connector.lower()} {explanation_text}"

        return base_interpretation

    def _naturalize_explanation(self, explanation_code: str) -> str:
        """Convertir código de explicación a lenguaje natural."""
        explanation_mapping = {
            "pneumonia_possible": "esto es consistente con una posible infección respiratoria",
            "fracture_possible": "esto sugiere una posible lesión ósea",
            "normal_findings": "sin hallazgos de alarma",
            "critical_symptoms": "que requiere evaluación inmediata",
        }
        return explanation_mapping.get(explanation_code, "que requiere evaluación clínica")

    def _generate_action_recommendation(
        self, urgency: str, tests: list[str] | None = None, emphasis: bool = False
    ) -> str:
        """Generar recomendación de acción."""
        # Mapear flag clínico a urgencia
        urgency_mapping = {
            "routine": "routine",
            "priority": "priority",
            "urgent": "urgent",
        }
        urgency_level = urgency_mapping.get(urgency, "routine")

        action_text = self._templates.get_action_recommendation(urgency_level)

        # Agregar tests si existen
        if tests:
            test_list = self._lexicon.get_symptom_list(tests)  # Reutilizamos para lista genérica
            action_text += f" Entre las pruebas sugeridas están: {test_list}."

        # Enfatizar si es urgente
        if emphasis and urgency_level == "urgent":
            action_text = f"⚠️ {action_text}"  # Emoji de advertencia para énfasis visual

        return action_text

    def _generate_disclaimer(self) -> str:
        """Generar disclaimer de seguridad clínica."""
        return self._templates.get_safety_disclaimer()

    def _assemble_sections(
        self,
        sections: dict[str, str],
        structure: list[str],
        tone: str,
        component_slots: dict[str, str],
        style_stage: str,
        history_size: int,
    ) -> str:
        """
        Ensamblar secciones en un texto coherente.

        Agregar conectores inteligentes entre secciones.
        """
        text_parts: list[str] = []

        framing = {
            "clinical_frame": "Con base en la evaluacion clinica actual,",
            "analytic_frame": "A partir del analisis disponible,",
            "companion_frame": "Tomando en cuenta lo que me has contado,",
            "supportive_frame": "Con todo lo que vienes describiendo,",
            "direct_frame": "Voy al punto con los hallazgos,",
            "urgent_frame": "Este es el punto clave ahora,",
        }.get(component_slots.get("framing", ""), "")
        if framing:
            text_parts.append(framing)

        if history_size >= 2:
            if style_stage == "formal":
                text_parts.append("he revisado el historial completo de esta conversacion")
            elif style_stage == "cercano":
                text_parts.append("tengo en cuenta todo lo que hablamos antes")
            else:
                text_parts.append("considero todo el historial de esta charla")

        for i, section in enumerate(structure):
            if section in sections:
                section_text = sections[section].strip()

                # Agregar conectores entre secciones (excepto al inicio)
                if i > 0 and section != "disclaimer":
                    connector = self._templates.get_connector(
                        connector_type=self._get_connector_type(section)
                    )
                    section_text = f"{connector.capitalize()} {section_text[0].lower()}{section_text[1:]}"

                text_parts.append(section_text)

        # Unir con espacios, respetando puntuación
        full_text = " ".join(text_parts)

        certainty_tail = {
            "cautious": "Esta orientacion es preliminar.",
            "balanced": "La recomendacion requiere correlacion clinica.",
            "actionable": "Conviene actuar siguiendo estas recomendaciones.",
            "urgent": "La prioridad es realizar evaluacion medica inmediata.",
        }.get(component_slots.get("certainty", ""), "")
        if certainty_tail:
            full_text = f"{full_text} {certainty_tail}".strip()

        # Asegurar terminación correcta
        if not full_text.endswith((".","!","?")):
            full_text += "."

        return full_text

    def _get_connector_type(self, section: str) -> str:
        """Determinar tipo de conector según sección."""
        if section in ["clinical_interpretation"]:
            return "additive"
        elif section in ["action", "action_urgent"]:
            return "conclusion"
        elif section == "disclaimer":
            return "contrast"
        return "additive"

    def _validate_and_sanitize(self, text: str) -> str:
        """
        Validar y sanitizar el texto.

        - No permitir vacío
        - Limitar longitud
        - Remover caracteres peligrosos
        """
        if not text or len(text) < self._min_length:
            raise ValueError(
                f"Texto generado inválido: menor a {self._min_length} caracteres"
            )

        if len(text) > self._max_length:
            # Truncar con gracia
            text = text[: self._max_length - 3] + "..."

        # Sanitizar
        text = text.replace("\n", " ").replace("\t", " ")
        text = " ".join(text.split())  # Normalizar espacios

        return text
