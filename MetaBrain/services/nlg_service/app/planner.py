"""Planner: decides message structure without generating text."""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from typing import Literal

from services.shared.contracts import DecisionOutput


@dataclass
class MessagePlan:
    """Plan de mensaje: estructura sin texto generado aún."""
    
    intent: str
    risk_level: Literal["low", "medium", "high"]
    structure: list[str]  # Secciones: ["opening", "risk_intro", "clinical_interpretation", "action", "disclaimer"]
    should_include_tests: bool
    should_emphasize_urgency: bool
    tone: Literal["reassuring", "informative", "urgent"]
    style_stage: Literal["formal", "cercano", "directo"]
    history_size: int
    variations_to_use: dict[str, str]  # Mapping de secciones a variante seleccionada
    component_slots: dict[str, str]


class MessagePlanner:
    """
    Planificador determinístico: decide estructura del mensaje sin generar texto.
    
    Reglas:
    - Alto riesgo → orden: risk_intro + clinical_interpretation + action (urgente)
    - Riesgo medio → orden: risk_intro + clinical_interpretation + action (prioritario)
    - Bajo riesgo → orden: opening + clinical_interpretation + action (rutinario)
    """

    def plan(
        self,
        decision_output: DecisionOutput,
        dialogue_intent: str = "default",
        patient_symptoms: list[str] | None = None,
        turn_index: int = 1,
        history_size: int = 0,
    ) -> MessagePlan:
        """
        Planificar estructura del mensaje.
        
        Args:
            decision_output: Salida de decision-service
            dialogue_intent: Intención de diálogo del usuario
            patient_symptoms: Síntomas reportados
            
        Returns:
            MessagePlan con estructura y variaciones
        """
        risk_level = decision_output.risk_level
        clinical_flag = decision_output.clinical_flag
        style_stage = self._get_style_stage(turn_index)
        
        # Determinar tone según riesgo
        tone = self._get_tone(risk_level)
        
        # Determinar estructura según riesgo
        structure = self._plan_structure(risk_level, dialogue_intent)
        
        # Decidir si incluir tests
        should_include_tests = hasattr(decision_output, "recommended_tests") and len(getattr(decision_output, "recommended_tests", [])) > 0
        
        # Decidir si enfatizar urgencia
        should_emphasize_urgency = risk_level == "high" or clinical_flag == "urgent"
        
        # Seleccionar variaciones para cada sección
        variations = self._select_variations(
            decision_output=decision_output,
            dialogue_intent=dialogue_intent,
            structure=structure,
        )
        component_slots = self._select_component_slots(
            risk_level=risk_level,
            dialogue_intent=dialogue_intent,
            clinical_flag=clinical_flag,
            style_stage=style_stage,
            turn_index=turn_index,
            history_size=history_size,
        )
        
        return MessagePlan(
            intent=dialogue_intent,
            risk_level=risk_level,
            structure=structure,
            should_include_tests=should_include_tests,
            should_emphasize_urgency=should_emphasize_urgency,
            tone=tone,
            style_stage=style_stage,
            history_size=history_size,
            variations_to_use=variations,
            component_slots=component_slots,
        )

    def _get_style_stage(self, turn_index: int) -> Literal["formal", "cercano", "directo"]:
        if turn_index <= 1:
            return "formal"
        if turn_index <= 4:
            return "cercano"
        return "directo"

    def _get_tone(self, risk_level: str) -> Literal["reassuring", "informative", "urgent"]:
        """Determinar tono según riesgo."""
        if risk_level == "high":
            return "urgent"
        elif risk_level == "medium":
            return "informative"
        else:
            return "reassuring"

    def _plan_structure(
        self, risk_level: str, dialogue_intent: str
    ) -> list[str]:
        """
        Planificar orden de secciones del mensaje.
        
        Lógica:
        - Alto riesgo: Iniciar con riesgo, luego interpretación, finalmente acción urgente
        - Riesgo medio: Riesgo, interpretación, acción prioritaria
        - Bajo riesgo: Apertura contextual, interpretación, acción rutinaria
        """
        base_structure = [
            "risk_intro",
            "clinical_interpretation",
            "action",
        ]
        
        if risk_level == "low":
            # Para bajo riesgo, agregar apertura para contextualizar
            base_structure = ["opening", "clinical_interpretation", "action"]
        elif risk_level == "high":
            # Para alto riesgo, colocar acción al final con énfasis
            base_structure = [
                "risk_intro",
                "clinical_interpretation",
                "action_urgent",
            ]
        
        # Agregar disclaimer de seguridad al final
        base_structure.append("disclaimer")
        
        return base_structure

    def _select_variations(
        self,
        decision_output: DecisionOutput,
        dialogue_intent: str,
        structure: list[str],
    ) -> dict[str, str]:
        """
        Seleccionar qué variante usar para cada sección.
        
        Aquí se determinan los "placeholders" que luego el generator rellenará.
        """
        variations: dict[str, str] = {}
        
        for section in structure:
            if section == "opening":
                # Seleccionar apertura según intent
                variations[section] = self._select_opening_variant(dialogue_intent)
            elif section == "risk_intro":
                # Seleccionar intro de riesgo según nivel
                variations[section] = decision_output.risk_level
            elif section == "clinical_interpretation":
                # Seleccionar interpretación según findings
                variations[section] = self._select_interpretation_variant(
                    decision_output.explanations
                )
            elif section in ["action", "action_urgent"]:
                # Seleccionar acción según urgencia
                variations[section] = decision_output.clinical_flag
            elif section == "disclaimer":
                # Disclaimer es genérico
                variations[section] = "safety"
        
        return variations

    def _select_opening_variant(self, dialogue_intent: str) -> str:
        """Seleccionar variante de apertura."""
        intent_mapping = {
            "symptom_report": "symptom_report",
            "severity_question": "severity_question",
            "follow_up_question": "follow_up",
        }
        return intent_mapping.get(dialogue_intent, "default")

    def _select_interpretation_variant(self, explanations: list[str]) -> str:
        """Seleccionar variante de interpretación clínica."""
        # Mapear explicaciones a códigos de interpretación
        if not explanations:
            return "normal"
        
        explanation = explanations[0].lower()
        
        if "pneumonia" in explanation or "respiratory" in explanation:
            return "possible_pneumonia"
        elif "fracture" in explanation or "bone" in explanation:
            return "possible_fracture"
        else:
            return "normal"

    def _select_component_slots(
        self,
        *,
        risk_level: str,
        dialogue_intent: str,
        clinical_flag: str,
        style_stage: str,
        turn_index: int,
        history_size: int,
    ) -> dict[str, str]:
        key = f"{risk_level}:{dialogue_intent}:{clinical_flag}:{style_stage}:{turn_index}:{history_size}"

        def pick(options: list[str], salt: str) -> str:
            digest = sha256(f"{key}:{salt}".encode("utf-8")).hexdigest()
            return options[int(digest[:8], 16) % len(options)]

        framing_by_stage = {
            "formal": ["clinical_frame", "analytic_frame"],
            "cercano": ["companion_frame", "supportive_frame"],
            "directo": ["direct_frame", "urgent_frame"],
        }

        certainty_by_risk = {
            "low": ["cautious", "balanced"],
            "medium": ["balanced", "actionable"],
            "high": ["actionable", "urgent"],
        }

        return {
            "framing": pick(framing_by_stage.get(style_stage, ["clinical_frame"]), "framing"),
            "certainty": pick(certainty_by_risk.get(risk_level, ["balanced"]), "certainty"),
            "bridging": pick(["neutral", "warm", "assertive"], "bridging"),
        }
