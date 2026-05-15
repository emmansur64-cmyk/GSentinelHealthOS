"""MetaBrain NLU engine (single source of truth).

Este módulo centraliza la detección de intención y extracción de entidades
para todo el runtime del proyecto.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from typing import Any, Optional

from brain.core.date_resolver import DateResolver
from shared.utils import setup_logger

logger = setup_logger(__name__)


@dataclass
class CachedLesson:
    id: str
    pattern: str
    correct_action: str
    category: str
    doctor_id: str
    cached_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class PatternMatch:
    lesson_id: str
    pattern: str
    action: str
    category: str
    similarity: float
    is_exact: bool
    match_type: str


class LessonCache:
    """In-memory cache de lecciones por doctor con TTL."""

    def __init__(self, ttl_seconds: int = 300):
        self._cache: dict[str, list[CachedLesson]] = {}
        self._ttl = timedelta(seconds=ttl_seconds)

    def get(self, doctor_id: str) -> Optional[list[CachedLesson]]:
        if doctor_id not in self._cache:
            return None
        lessons = self._cache[doctor_id]
        if not lessons:
            return None

        cached_time = lessons[0].cached_at
        if datetime.utcnow() - cached_time > self._ttl:
            del self._cache[doctor_id]
            return None
        return lessons

    def set(self, doctor_id: str, lessons: list[CachedLesson]) -> None:
        self._cache[doctor_id] = lessons

    def clear(self, doctor_id: Optional[str] = None) -> None:
        if doctor_id:
            self._cache.pop(doctor_id, None)
        else:
            self._cache.clear()


class KnowledgeMatcher:
    EXACT_MATCH_THRESHOLD = 0.95
    FUZZY_MATCH_THRESHOLD = 0.70
    MIN_SIMILARITY_TO_USE = 0.65

    @staticmethod
    def _normalize_for_matching(text: str) -> str:
        return text.lower().strip()

    @classmethod
    def find_best_match(
        cls,
        user_text: str,
        lessons: list[CachedLesson],
    ) -> Optional[PatternMatch]:
        normalized_input = cls._normalize_for_matching(user_text)

        best_match: Optional[PatternMatch] = None
        best_similarity = 0.0

        for lesson in lessons:
            normalized_pattern = cls._normalize_for_matching(lesson.pattern)

            if normalized_pattern == normalized_input:
                return PatternMatch(
                    lesson_id=lesson.id,
                    pattern=lesson.pattern,
                    action=lesson.correct_action,
                    category=lesson.category,
                    similarity=1.0,
                    is_exact=True,
                    match_type="exact",
                )

            similarity = SequenceMatcher(None, normalized_input, normalized_pattern).ratio()
            if similarity > best_similarity:
                best_similarity = similarity
                if similarity >= cls.FUZZY_MATCH_THRESHOLD:
                    best_match = PatternMatch(
                        lesson_id=lesson.id,
                        pattern=lesson.pattern,
                        action=lesson.correct_action,
                        category=lesson.category,
                        similarity=similarity,
                        is_exact=False,
                        match_type="fuzzy",
                    )

        if best_match and best_similarity >= cls.MIN_SIMILARITY_TO_USE:
            return best_match
        return None


class NLUEngine:
    """Motor MetaBrain para intención + entidades."""

    _lesson_cache: LessonCache = LessonCache(ttl_seconds=300)
    _metrics = {
        "total_queries": 0,
        "knowledge_hits": 0,
        "knowledge_misses": 0,
        "metabrain_queries": 0,
    }

    SPECIALTIES: dict[str, tuple[str, ...]] = {
        "Cardiologia": ("cardiologia", "cardio", "corazon"),
        "Dermatologia": ("dermatologia", "dermato", "piel"),
        "Ginecologia": ("ginecologia", "gine", "gineco"),
        "Medicina General": ("medicina general", "medico general", "clinica general", "general"),
        "Neurologia": ("neurologia", "neuro"),
        "Oftalmologia": ("oftalmologia", "oculista", "vision", "vista"),
        "Pediatria": ("pediatria", "pediatra", "nino", "nina"),
        "Traumatologia": ("traumatologia", "trauma", "traumatologo"),
    }

    @staticmethod
    def _normalize(text: str) -> str:
        return DateResolver.normalize(text)

    @classmethod
    def _extract_specialty(cls, normalized_text: str) -> str | None:
        for specialty, aliases in cls.SPECIALTIES.items():
            if any(alias in normalized_text for alias in aliases):
                return specialty
        return None

    @classmethod
    def _score_confidence(
        cls,
        text: str,
        intent: str,
        learning_context: str = "",
    ) -> float:
        if intent == "SYSTEM_RESET":
            return 0.95

        normalized = cls._normalize(text)
        strong_tokens: tuple[str, ...]
        if intent == "book_appointment":
            strong_tokens = ("turno", "cita", "agendar", "reservar", "quiero turno", "necesito turno")
        elif intent == "cancel_appointment":
            strong_tokens = ("cancelar", "cancelacion", "anular", "borrar", "baja", "suspender")
        elif intent == "check_availability":
            strong_tokens = ("disponibilidad", "horario", "cuando", "hay turno", "consultar")
        else:
            strong_tokens = ()

        hits = sum(1 for token in strong_tokens if token in normalized)
        base = 0.5 if hits == 0 else min(0.55 + 0.10 * hits, 0.80)

        if learning_context.strip():
            base = min(base + 0.10, 0.90)

        return round(base, 2)

    @classmethod
    async def classify_intent(cls, text: str) -> str:
        normalized = cls._normalize(text)
        reset_commands = (
            "reiniciar conversacion",
            "reset",
            "empezar de nuevo",
            "borrar contexto",
            "limpiar conversacion",
        )
        if any(token in normalized for token in reset_commands):
            return "SYSTEM_RESET"

        cancellation_targets = ("turno", "cita", "appointment", "reserva")
        cancellation_verbs = ("cancelar", "cancelacion", "baja", "borrar", "anular", "suspender")
        if any(verb in normalized for verb in cancellation_verbs) and any(
            target in normalized for target in cancellation_targets
        ):
            return "cancel_appointment"

        if any(token in normalized for token in ("anular cita", "suspender cita")):
            return "cancel_appointment"

        if any(token in normalized for token in ("turno", "cita", "agendar", "reservar")):
            return "book_appointment"

        if any(token in normalized for token in ("consultar", "horario", "disponibilidad", "doctor")):
            return "check_availability"

        return "general_query"

    @classmethod
    def extract_basic_entities(
        cls,
        text: str,
        reference_datetime: datetime | None = None,
    ) -> dict[str, Any]:
        normalized = cls._normalize(text)
        reference = reference_datetime or datetime.utcnow()
        specialty = cls._extract_specialty(normalized)
        resolved_datetime = DateResolver.resolve(normalized, reference_datetime=reference)
        return {"specialty": specialty, **resolved_datetime}

    @classmethod
    async def analyze(
        cls,
        text: str,
        reference_datetime: datetime | None = None,
        history: Any = None,
        learning_context: str = "",
    ) -> dict[str, Any]:
        _ = history
        cls._metrics["metabrain_queries"] += 1
        intent = await cls.classify_intent(text)
        entities = cls.extract_basic_entities(text, reference_datetime=reference_datetime)
        confidence = cls._score_confidence(text, intent, learning_context=learning_context)
        return {
            "intent": intent,
            "entities": entities,
            "confidence": confidence,
            "source": "METABRAIN",
        }

    @classmethod
    async def analyze_with_learning(
        cls,
        text: str,
        doctor_id: str,
        *,
        history: Any = None,
        reference_datetime: datetime | None = None,
        api_client: Any = None,
    ) -> dict[str, Any]:
        cls._metrics["total_queries"] += 1

        lessons: list[CachedLesson] = []
        knowledge_match: Optional[PatternMatch] = None
        learning_context = ""

        if api_client is not None and doctor_id:
            cached = cls._lesson_cache.get(doctor_id)
            if cached is None:
                try:
                    raw_lessons = await api_client.get_bot_lessons(doctor_id)
                    if raw_lessons:
                        lessons = [
                            CachedLesson(
                                id=lesson.get("id", lesson.get("lesson_id", "")),
                                pattern=lesson.get("pattern", ""),
                                correct_action=lesson.get("correct_action", ""),
                                category=lesson.get("category", ""),
                                doctor_id=doctor_id,
                            )
                            for lesson in raw_lessons
                            if str(lesson.get("pattern") or "").strip()
                            and str(lesson.get("correct_action") or "").strip()
                        ]
                        if lessons:
                            cls._lesson_cache.set(doctor_id, lessons)
                except Exception as exc:
                    logger.warning("[Knowledge] Error obteniendo lecciones: %s", exc)
            else:
                lessons = cached

        if lessons:
            knowledge_match = KnowledgeMatcher.find_best_match(text, lessons)
            if knowledge_match:
                cls._metrics["knowledge_hits"] += 1
            else:
                cls._metrics["knowledge_misses"] += 1
        else:
            cls._metrics["knowledge_misses"] += 1

        if lessons:
            learning_context = "El medico ha ensenado al bot las siguientes correcciones:\n"
            if knowledge_match:
                learning_context += (
                    "PATRON SIMILAR DETECTADO:\n"
                    f"  Entrada similar: '{knowledge_match.pattern}'\n"
                    f"  Accion esperada: {knowledge_match.action}\n"
                    f"  Confianza del match: {knowledge_match.similarity:.2%}\n\n"
                )
            learning_context += "Otras correcciones disponibles:\n"
            for idx, lesson in enumerate(lessons[:5], 1):
                learning_context += f"{idx}. '{lesson.pattern}' -> {lesson.correct_action} ({lesson.category})\n"

        if knowledge_match and knowledge_match.is_exact:
            inferred_intent = await cls.classify_intent(text)
            return {
                "intent": inferred_intent,
                "entities": cls.extract_basic_entities(text, reference_datetime=reference_datetime),
                "confidence": 0.99,
                "source": "knowledge_base",
                "learned_action": knowledge_match.action,
                "knowledge_match": {
                    "pattern": knowledge_match.pattern,
                    "category": knowledge_match.category,
                    "similarity": knowledge_match.similarity,
                    "type": knowledge_match.match_type,
                },
            }

        analysis = await cls.analyze(
            text,
            reference_datetime=reference_datetime,
            history=history,
            learning_context=learning_context,
        )

        if knowledge_match and knowledge_match.similarity > 0.85:
            analysis["confidence"] = min(1.0, analysis["confidence"] + 0.15)
            analysis["knowledge_match"] = {
                "pattern": knowledge_match.pattern,
                "action": knowledge_match.action,
                "category": knowledge_match.category,
                "similarity": knowledge_match.similarity,
                "type": knowledge_match.match_type,
            }

        return analysis

    @classmethod
    def get_knowledge_metrics(cls) -> dict[str, Any]:
        total = cls._metrics["total_queries"] or 1
        hit_rate = cls._metrics["knowledge_hits"] / total if total > 0 else 0.0
        return {
            "total_queries": cls._metrics["total_queries"],
            "knowledge_hits": cls._metrics["knowledge_hits"],
            "knowledge_misses": cls._metrics["knowledge_misses"],
            "hit_rate": f"{hit_rate:.2%}",
            "metabrain_queries": cls._metrics["metabrain_queries"],
        }

    @classmethod
    def clear_knowledge_cache(cls, doctor_id: Optional[str] = None) -> None:
        cls._lesson_cache.clear(doctor_id)
