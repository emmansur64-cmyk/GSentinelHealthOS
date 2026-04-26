from __future__ import annotations

import random
from typing import Any, Dict, List


class LinguisticEngine:
    """Rule engine linguistico para NLG sin LLM."""

    def __init__(self) -> None:
        self.intros = [
            "Por lo que describis,",
            "Con la informacion que das,",
            "Analizando lo que mencionas,",
            "En base a lo que contas,",
        ]

        self.risk_templates = [
            "el nivel de riesgo es {risk}",
            "se observa un riesgo {risk}",
            "la situacion indica un riesgo {risk}",
        ]

        self.triage_templates = [
            "el triage corresponde a {triage}",
            "el nivel de triage es {triage}",
            "esto encaja con un triage {triage}",
        ]

        self.symptom_templates = [
            "los sintomas principales son {symptoms}",
            "lo mas relevante es {symptoms}",
            "se destacan {symptoms}",
        ]

        self.emergency_phrases = [
            "esto podria requerir atencion inmediata",
            "hay indicios de posible urgencia",
            "conviene evaluar esto con rapidez",
        ]

        self.clarification_phrases = [
            "faltan algunos datos clave",
            "seria util tener mas informacion",
            "necesitamos mas detalles para precisar",
        ]

        self.endings = [
            "Si podes dar mas detalles, lo vemos mejor.",
            "Contame si hay algun otro sintoma.",
            "Podemos ajustar esto con mas informacion.",
            "Si queres, profundizamos un poco mas.",
        ]

        self.greetings = [
            "Hola, como estas?",
            "Hola, como va todo?",
            "Hola, como te sentis?",
        ]

        self.low_information_phrases = [
            "todavia necesito un poco mas de informacion para poder orientarte mejor",
            "con lo que tengo hasta ahora, me faltan algunos datos para responder con precision",
            "para darte una respuesta mas util, necesito que me cuentes un poco mas",
        ]

    def _pick_unique(self, session_state: Dict[str, Any], key: str, options: List[str]) -> str:
        last = session_state.get(f"last_{key}")
        choices = [option for option in options if option != last] or options
        selected = random.choice(choices)
        session_state[f"last_{key}"] = selected
        return selected

    @staticmethod
    def _ensure_sentence(text: str) -> str:
        cleaned = " ".join(str(text or "").split()).strip()
        cleaned = cleaned.rstrip(" ,.;:")
        if not cleaned:
            return ""
        return cleaned[0].upper() + cleaned[1:] + "."

    def _build_message(
        self,
        intro: str,
        blocks: List[str],
        ending: str,
        session_state: Dict[str, Any],
    ) -> str:
        intro_text = " ".join(str(intro or "").split()).strip()
        if blocks:
            first_block, *remaining = blocks
            parts = [f"{intro_text} {str(first_block).strip()}"]
            parts.extend(remaining)
        else:
            fallback = self._pick_unique(session_state, "low_info", self.low_information_phrases)
            parts = [f"{intro_text} {fallback}"]

        parts.append(ending)
        sentences = [self._ensure_sentence(part) for part in parts if str(part).strip()]
        return " ".join(sentence for sentence in sentences if sentence)

    def generate(
        self,
        intent: str,
        decision: Dict[str, Any],
        context: Dict[str, Any],
        session_state: Dict[str, Any],
    ) -> str:
        if intent in {"greeting", "small_talk"} or context.get("input_type") == "casual":
            greeting = self._pick_unique(session_state, "greeting", self.greetings)
            session_state["last_response"] = greeting
            return greeting

        parts: List[str] = []

        intro = self._pick_unique(session_state, "intro", self.intros)
        parts.append(intro)

        blocks: List[str] = []

        risk = decision.get("risk_level")
        if isinstance(risk, str) and risk and risk != "unknown":
            template = random.choice(self.risk_templates)
            blocks.append(template.format(risk=risk))

        triage = decision.get("triage_level")
        if isinstance(triage, str) and triage and triage != "unknown":
            template = random.choice(self.triage_templates)
            blocks.append(template.format(triage=triage))

        symptoms = context.get("symptoms", [])
        if isinstance(symptoms, list):
            clean_symptoms = [str(symptom).strip() for symptom in symptoms if str(symptom).strip()]
            if clean_symptoms:
                template = random.choice(self.symptom_templates)
                blocks.append(template.format(symptoms=", ".join(clean_symptoms)))

        flags = decision.get("flags", [])
        if isinstance(flags, list):
            if "possible_emergency" in flags:
                blocks.append(random.choice(self.emergency_phrases))
            if "needs_clarification" in flags:
                blocks.append(random.choice(self.clarification_phrases))

        random.shuffle(blocks)

        ending = self._pick_unique(session_state, "ending", self.endings)
        message = self._build_message(intro, blocks, ending, session_state)

        if message == session_state.get("last_response"):
            random.shuffle(blocks)
            ending = self._pick_unique(session_state, "ending", self.endings)
            message = self._build_message(intro, blocks, ending, session_state)

        session_state["last_response"] = message
        return message
