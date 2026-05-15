from __future__ import annotations

from functools import lru_cache

from cerebro_ai_med.models.ml_model import ProductionMedicalTriageModel


@lru_cache(maxsize=1)
def get_model_service() -> ProductionMedicalTriageModel:
    return ProductionMedicalTriageModel()