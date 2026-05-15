from __future__ import annotations

import math
import re
from dataclasses import dataclass

from cerebro_ai_med.models.schemas import ModelInput, ModelOutput, RiskLevel


@dataclass(frozen=True)
class BaselineModelConfig:
    model_name: str = "baseline_medical_triage"
    model_version: str = "2.0.0"


class BaselineMedicalTriageModel:
    def __init__(self, config: BaselineModelConfig | None = None) -> None:
        self._config = config or BaselineModelConfig()

    def predict(self, data: ModelInput) -> ModelOutput:
        if data.source_type == "text":
            return self._predict_text(data)
        return self._predict_image(data)

    def _predict_text(self, data: ModelInput) -> ModelOutput:
        text = (data.text or "").strip().lower()
        if not text:
            raise ValueError("text input is required for source_type=text")

        critical_hits = self._count_keywords(text, ("shock", "sepsis", "hemorrag", "paro", "anuria", "saturacion 80"))
        urgent_hits = self._count_keywords(text, ("disnea", "dolor torac", "hipoxia", "desatur", "convulsion", "fiebre alta"))
        warning_hits = self._count_keywords(text, ("dolor", "fiebre", "tos", "taquicardia", "mareo", "vomito"))
        token_count = float(len(re.findall(r"[a-zA-Z0-9_]+", text)))

        logits = {
            "low": 1.8 - 1.6 * critical_hits - 0.7 * urgent_hits - 0.2 * warning_hits,
            "medium": 0.9 + 0.3 * urgent_hits + 0.2 * warning_hits + 0.004 * token_count,
            "high": -0.4 + 1.4 * critical_hits + 0.9 * urgent_hits + 0.1 * warning_hits,
        }
        probabilities = self._softmax(logits)
        risk_level = self._argmax(probabilities)
        confidence = self._margin_confidence(probabilities)

        finding_code = {
            "low": "stable_pattern",
            "medium": "needs_clinical_review",
            "high": "critical_alert_pattern",
        }[risk_level]
        recommendation_code = {
            "low": "routine_followup",
            "medium": "priority_evaluation",
            "high": "urgent_immediate_evaluation",
        }[risk_level]

        return ModelOutput(
            model_name=self._config.model_name,
            model_version=self._config.model_version,
            risk_level=risk_level,
            finding_code=finding_code,
            confidence=confidence,
            probabilities=probabilities,
            recommendation_code=recommendation_code,
            features_used={
                "critical_hits": float(critical_hits),
                "urgent_hits": float(urgent_hits),
                "warning_hits": float(warning_hits),
                "token_count": token_count,
            },
        )

    def _predict_image(self, data: ModelInput) -> ModelOutput:
        if data.image_bytes is None or data.image_width is None or data.image_height is None:
            raise ValueError("image metadata is required for source_type=image")

        pixels_million = (data.image_width * data.image_height) / 1_000_000.0
        aspect_ratio = data.image_width / max(data.image_height, 1)
        bytes_per_pixel = data.image_bytes / max(float(data.image_width * data.image_height), 1.0)
        modality_weight = {"XRAY": 0.0, "CT": 0.15, "MRI": 0.2, "TEXT": 0.0}[data.modality]

        logits = {
            "low": 1.2 - 0.7 * modality_weight - 0.4 * max(0.0, 0.5 - pixels_million),
            "medium": 0.8 + 0.2 * modality_weight + 0.2 * abs(1.0 - aspect_ratio),
            "high": -0.7 + 0.9 * modality_weight + 0.6 * max(0.0, 0.4 - bytes_per_pixel),
        }
        probabilities = self._softmax(logits)
        risk_level = self._argmax(probabilities)
        confidence = self._margin_confidence(probabilities)

        finding_code = {
            "low": "image_quality_acceptable",
            "medium": "image_requires_targeted_review",
            "high": "image_quality_or_pattern_alert",
        }[risk_level]
        recommendation_code = {
            "low": "continue_standard_pipeline",
            "medium": "route_to_specialist_review",
            "high": "priority_specialist_validation",
        }[risk_level]

        return ModelOutput(
            model_name=self._config.model_name,
            model_version=self._config.model_version,
            risk_level=risk_level,
            finding_code=finding_code,
            confidence=confidence,
            probabilities=probabilities,
            recommendation_code=recommendation_code,
            features_used={
                "pixels_million": float(round(pixels_million, 5)),
                "aspect_ratio": float(round(aspect_ratio, 5)),
                "bytes_per_pixel": float(round(bytes_per_pixel, 7)),
                "modality_weight": float(modality_weight),
            },
        )

    @staticmethod
    def _count_keywords(text: str, keywords: tuple[str, ...]) -> int:
        return sum(1 for keyword in keywords if keyword in text)

    @staticmethod
    def _softmax(logits: dict[RiskLevel, float]) -> dict[RiskLevel, float]:
        max_logit = max(logits.values())
        exps = {key: math.exp(value - max_logit) for key, value in logits.items()}
        total = sum(exps.values())
        normalized = {key: exps[key] / total for key in ("low", "medium", "high")}
        return {
            "low": float(round(normalized["low"], 6)),
            "medium": float(round(normalized["medium"], 6)),
            "high": float(round(normalized["high"], 6)),
        }

    @staticmethod
    def _argmax(probabilities: dict[RiskLevel, float]) -> RiskLevel:
        return max(probabilities, key=probabilities.get)

    @staticmethod
    def _margin_confidence(probabilities: dict[RiskLevel, float]) -> float:
        ordered = sorted(probabilities.values(), reverse=True)
        margin = max(0.0, ordered[0] - ordered[1])
        return float(round(min(1.0, 0.5 + margin), 6))