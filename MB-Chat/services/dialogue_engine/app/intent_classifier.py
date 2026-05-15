from __future__ import annotations

import re

from services.dialogue_engine.app.schemas import IntentType


class RuleBasedIntentClassifier:
    def __init__(self) -> None:
        self._intent_keywords: dict[IntentType, tuple[str, ...]] = {
            "symptom_report": (
                "dolor",
                "fiebre",
                "tos",
                "disnea",
                "mareo",
                "nausea",
                "vomito",
                "fatiga",
                "palpitaciones",
                "me duele",
                "sintoma",
            ),
            "follow_up_question": (
                "que sigue",
                "siguiente paso",
                "y ahora",
                "despues",
                "what next",
                "next step",
                "seguimiento",
            ),
            "severity_question": (
                "es grave",
                "gravedad",
                "riesgo",
                "urgente",
                "emergencia",
                "severity",
                "serious",
            ),
            "greeting": (
                "hola",
                "buenas",
                "hello",
                "hi",
                "buen dia",
                "buenas tardes",
                "good morning",
            ),
            "unknown": tuple(),
        }

        self._symptom_map: dict[str, tuple[str, ...]] = {
            "fever": ("fiebre", "fever", "temperatura"),
            "cough": ("tos", "cough"),
            "dyspnea": ("disnea", "dyspnea", "falta de aire", "shortness of breath"),
            "chest_pain": ("dolor de pecho", "dolor toracico", "chest pain"),
            "headache": ("dolor de cabeza", "cefalea", "headache"),
            "fatigue": ("fatiga", "cansancio", "fatigue"),
            "nausea": ("nausea", "nauseas", "nausea"),
        }

    def classify(self, message: str) -> IntentType:
        text = self._normalize(message)
        if not text:
            return "unknown"

        scores: dict[IntentType, int] = {
            "symptom_report": 0,
            "follow_up_question": 0,
            "severity_question": 0,
            "greeting": 0,
            "unknown": 0,
        }

        for intent, words in self._intent_keywords.items():
            for word in words:
                if word in text:
                    scores[intent] += 1

        if "?" in text:
            scores["follow_up_question"] += 1

        if self.extract_symptoms(text):
            scores["symptom_report"] += 2

        top_intent = max(scores, key=scores.get)
        if scores[top_intent] == 0:
            return "unknown"
        return top_intent

    def extract_entities(self, message: str) -> tuple[set[str], dict[str, str]]:
        text = self._normalize(message)
        symptoms = self.extract_symptoms(text)
        details: dict[str, str] = {}

        duration = self._extract_duration(text)
        if duration is not None:
            details["duration"] = duration

        intensity = self._extract_intensity(text)
        if intensity is not None:
            details["intensity"] = intensity

        return symptoms, details

    def extract_symptoms(self, text: str) -> set[str]:
        found: set[str] = set()
        for normalized, aliases in self._symptom_map.items():
            if any(alias in text for alias in aliases):
                found.add(normalized)
        return found

    def _extract_duration(self, text: str) -> str | None:
        match = re.search(r"(\d+)\s*(hora|horas|dia|dias|day|days|week|weeks)", text)
        if not match:
            return None
        value = match.group(1)
        unit = match.group(2)
        return f"{value} {unit}"

    def _extract_intensity(self, text: str) -> str | None:
        if any(word in text for word in ("leve", "mild")):
            return "mild"
        if any(word in text for word in ("moderado", "moderada", "moderate")):
            return "moderate"
        if any(word in text for word in ("severo", "severa", "intenso", "grave", "severe")):
            return "severe"
        return None

    @staticmethod
    def _normalize(value: str) -> str:
        return " ".join(value.lower().strip().split())
