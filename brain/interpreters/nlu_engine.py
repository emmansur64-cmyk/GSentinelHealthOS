"""Compatibility shim for NLU.

Fuente de verdad movida a MetaBrain.nlu_engine.
"""

from MetaBrain.nlu_engine import CachedLesson, KnowledgeMatcher, LessonCache, NLUEngine, PatternMatch

__all__ = [
    "CachedLesson",
    "KnowledgeMatcher",
    "LessonCache",
    "NLUEngine",
    "PatternMatch",
]
