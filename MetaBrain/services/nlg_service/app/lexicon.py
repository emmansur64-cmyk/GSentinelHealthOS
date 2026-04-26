"""Semantic lexicon for medical NLG: symptom mappings, synonyms, and clinical terminology."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import random


@dataclass(frozen=True)
class SymptomVariant:
    """Variantes lingüísticas para un síntoma."""
    primary: str
    synonyms: list[str]
    formal: str  # Término médico formal
    casual: str  # Término coloquial


class MedicalLexicon:
    """Mapeo semántico sin LLM: síntomas → variantes lingüísticas."""

    def __init__(self) -> None:
        self._symptom_variants: dict[str, SymptomVariant] = {
            "fever": SymptomVariant(
                primary="fiebre",
                synonyms=["temperatura elevada", "alza térmica", "febrícula"],
                formal="hipertermia",
                casual="calentura",
            ),
            "cough": SymptomVariant(
                primary="tos",
                synonyms=["toser", "acceso de tos", "irritación de garganta"],
                formal="tos irritativa",
                casual="tocimiento",
            ),
            "dyspnea": SymptomVariant(
                primary="dificultad para respirar",
                synonyms=["falta de aire", "disnea", "respiración dificultosa"],
                formal="disnea",
                casual="ahogo",
            ),
            "chest_pain": SymptomVariant(
                primary="dolor en el pecho",
                synonyms=["molestia torácica", "opresión en el pecho", "dolor torácico"],
                formal="dolor torácico",
                casual="puntada en el pecho",
            ),
            "headache": SymptomVariant(
                primary="dolor de cabeza",
                synonyms=["cefalea", "jaqueca", "dolor craneal"],
                formal="cefalea",
                casual="dolencia de cabeza",
            ),
            "fatigue": SymptomVariant(
                primary="cansancio",
                synonyms=["debilidad", "agotamiento", "fatiga"],
                formal="astenia",
                casual="desgano",
            ),
            "nausea": SymptomVariant(
                primary="náuseas",
                synonyms=["sensación de vómito", "mareo estomacal", "arcadas"],
                formal="náusea",
                casual="ganas de vomitar",
            ),
            "tachycardia": SymptomVariant(
                primary="frecuencia cardíaca elevada",
                synonyms=["palpitaciones", "corazón acelerado", "taquicardia"],
                formal="taquicardia sinusal",
                casual="latidos rápidos",
            ),
        }

        self._risk_intensity_modifiers: dict[str, list[str]] = {
            "low": [
                "leve",
                "discreto",
                "sin importancia mayor",
                "de bajo riesgo",
            ],
            "medium": [
                "moderado",
                "considerable",
                "que requiere atención",
                "potencialmente importante",
            ],
            "high": [
                "significativo",
                "importante",
                "de alto riesgo",
                "que requiere atención urgente",
            ],
        }

        self._clinical_action_terms: dict[str, list[str]] = {
            "consultation": [
                "consulta",
                "evaluación",
                "valoración",
                "revisión clínica",
            ],
            "testing": [
                "pruebas complementarias",
                "estudios adicionales",
                "análisis",
                "investigación diagnóstica",
            ],
            "monitoring": [
                "vigilancia",
                "monitoreo",
                "seguimiento",
                "observación",
            ],
            "hospitalization": [
                "internación",
                "hospitalización",
                "ingreso hospitalario",
                "evaluación urgente",
            ],
        }

        self._clinical_interpretation_terms: dict[str, list[str]] = {
            "possible_infection": [
                "infección posible",
                "proceso infeccioso probable",
                "hallazgos sugestivos de infección",
            ],
            "possible_fracture": [
                "fractura posible",
                "lesión ósea probable",
                "hallazgos compatibles con fractura",
            ],
            "cardiovascular_concern": [
                "preocupación cardiovascular",
                "hallazgos cardiopulmonares",
                "afección cardiovascular posible",
            ],
            "respiratory_issue": [
                "afección respiratoria",
                "compromiso pulmonar",
                "problema respiratorio",
            ],
            "normal_findings": [
                "hallazgos normales",
                "sin alteraciones significativas",
                "resultado dentro de lo esperado",
            ],
        }

    def get_symptom_variant(
        self, symptom_code: str, style: Literal["formal", "casual", "neutral"] = "neutral"
    ) -> str:
        """
        Obtener variante lingüística de un síntoma.

        Args:
            symptom_code: Código del síntoma (ej: "fever")
            style: Estilo del lenguaje (formal/casual/neutral)

        Returns:
            Texto del síntoma en el estilo solicitado
        """
        variant = self._symptom_variants.get(symptom_code)
        if not variant:
            return symptom_code  # Fallback a código

        if style == "formal":
            return variant.formal
        elif style == "casual":
            return variant.casual
        else:  # neutral
            return random.choice([variant.primary] + variant.synonyms)

    def get_risk_modifier(self, risk_level: str) -> str:
        """Obtener modificador de riesgo para enfatizar urgencia."""
        modifiers = self._risk_intensity_modifiers.get(risk_level, [""])
        return random.choice(modifiers)

    def get_action_term(self, action_type: str) -> str:
        """Obtener término clínico para acción recomendada."""
        terms = self._clinical_action_terms.get(action_type, ["acción"])
        return random.choice(terms)

    def get_interpretation_term(self, interpretation_code: str) -> str:
        """Obtener término clínico para interpretación."""
        terms = self._clinical_interpretation_terms.get(
            interpretation_code, ["hallazgo clínico"]
        )
        return random.choice(terms)

    def get_all_symptoms(self) -> list[str]:
        """Obtener lista de todos los códigos de síntomas disponibles."""
        return list(self._symptom_variants.keys())

    def get_symptom_list(self, symptom_codes: list[str], style: str = "neutral") -> str:
        """
        Convertir lista de códigos de síntomas a texto natural.

        Ejemplo:
            ["fever", "cough"] → "fiebre y tos"
            ["fever", "cough", "dyspnea"] → "fiebre, tos y dificultad para respirar"
        """
        if not symptom_codes:
            return ""

        variants = [self.get_symptom_variant(code, style) for code in symptom_codes]
        
        if len(variants) == 1:
            return variants[0]
        elif len(variants) == 2:
            return f"{variants[0]} y {variants[1]}"
        else:
            return ", ".join(variants[:-1]) + f" y {variants[-1]}"
