from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from threading import RLock

import joblib
from sklearn.pipeline import Pipeline

from cerebro_ai_med.models.registry import ActiveModelSpec, parse_active_spec, parse_best_fallback_spec
from cerebro_ai_med.models.schemas import ModelInput, ModelOutput, RiskLevel


ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
REGISTRY_PATH = ARTIFACT_DIR / "metadata.json"


@dataclass(frozen=True)
class LoadedModelState:
    spec: ActiveModelSpec
    text_pipeline: Pipeline
    image_pipeline: Pipeline


class ProductionMedicalTriageModel:
    def __init__(self) -> None:
        self._state: LoadedModelState | None = None
        self._load_lock = RLock()

    def predict(self, data: ModelInput) -> ModelOutput:
        if data.source_type == "text":
            return self._predict_text(data)
        return self._predict_image(data)

    @property
    def model_name(self) -> str:
        return "production_medical_triage"

    @property
    def model_version(self) -> str:
        self._ensure_loaded()
        if self._state is None:
            return "unknown"
        return self._state.spec.version

    def _predict_text(self, data: ModelInput) -> ModelOutput:
        self._ensure_loaded()
        text = (data.text or "").strip()
        if not text:
            raise ValueError("text input is required for source_type=text")

        if self._state is None:
            raise RuntimeError("model_state_not_loaded")

        probabilities = self._predict_probabilities(self._state.text_pipeline, [text])[0]
        risk_level = self._argmax_risk(probabilities)
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

        features_used = self._text_features_used(text=text, predicted_class=risk_level)

        return ModelOutput(
            model_name=self.model_name,
            model_version=self.model_version,
            risk_level=risk_level,
            finding_code=finding_code,
            confidence=float(round(max(probabilities.values()), 6)),
            probabilities=probabilities,
            recommendation_code=recommendation_code,
            features_used=features_used,
        )

    def _predict_image(self, data: ModelInput) -> ModelOutput:
        self._ensure_loaded()
        if data.image_bytes is None or data.image_width is None or data.image_height is None:
            raise ValueError("image metadata is required for source_type=image")

        pixels_million = (data.image_width * data.image_height) / 1_000_000.0
        aspect_ratio = data.image_width / max(data.image_height, 1)
        bytes_per_pixel = data.image_bytes / max(float(data.image_width * data.image_height), 1.0)

        feature_row = {
            "pixels_million": float(round(pixels_million, 6)),
            "aspect_ratio": float(round(aspect_ratio, 6)),
            "bytes_per_pixel": float(round(bytes_per_pixel, 8)),
            "modality": data.modality,
        }

        if self._state is None:
            raise RuntimeError("model_state_not_loaded")

        probabilities = self._predict_probabilities(self._state.image_pipeline, [feature_row])[0]
        risk_level = self._argmax_risk(probabilities)
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
            model_name=self.model_name,
            model_version=self.model_version,
            risk_level=risk_level,
            finding_code=finding_code,
            confidence=float(round(max(probabilities.values()), 6)),
            probabilities=probabilities,
            recommendation_code=recommendation_code,
            features_used={
                "pixels_million": feature_row["pixels_million"],
                "aspect_ratio": feature_row["aspect_ratio"],
                "bytes_per_pixel": feature_row["bytes_per_pixel"],
            },
        )

    @staticmethod
    def _load_pipeline(path: Path) -> Pipeline:
        if not path.exists():
            raise RuntimeError(
                f"Model artifact not found: {path}. Run training: "
                "e:/MetaBrain/.venv/Scripts/python.exe -m cerebro_ai_med.models.train_models"
            )
        loaded: Any = joblib.load(path)
        if not isinstance(loaded, Pipeline):
            raise RuntimeError(f"Invalid pipeline artifact at {path}")
        return loaded

    @staticmethod
    def _predict_probabilities(pipeline: Pipeline | None, rows: list[Any]) -> list[dict[RiskLevel, float]]:
        if pipeline is None:
            raise RuntimeError("Pipeline not initialized")
        classifier = pipeline.named_steps["classifier"]
        classes = [str(c) for c in classifier.classes_]
        predicted = pipeline.predict_proba(rows)

        out: list[dict[RiskLevel, float]] = []
        for row in predicted:
            mapped = {k: 0.0 for k in ("low", "medium", "high")}
            for idx, value in enumerate(row):
                mapped[classes[idx]] = float(round(float(value), 6))
            out.append(mapped)
        return out

    @staticmethod
    def _argmax_risk(probabilities: dict[RiskLevel, float]) -> RiskLevel:
        return max(probabilities, key=probabilities.get)

    def _text_features_used(self, text: str, predicted_class: RiskLevel) -> dict[str, float]:
        if self._state is None:
            raise RuntimeError("Text pipeline not initialized")

        vectorizer = self._state.text_pipeline.named_steps["vectorizer"]
        classifier = self._state.text_pipeline.named_steps["classifier"]

        x = vectorizer.transform([text])
        class_index = list(classifier.classes_).index(predicted_class)
        _ = classifier.coef_[class_index]

        token_count = float(len(re.findall(r"[a-zA-Z0-9_]+", text.lower())))
        char_count = float(len(text))
        non_zero = float(getattr(x, "nnz", 0))

        return {
            "token_count": token_count,
            "char_count": char_count,
            "active_ngrams": non_zero,
        }

    def _ensure_loaded(self) -> None:
        if self._state is not None:
            return

        with self._load_lock:
            if self._state is not None:
                return

            previous_state = self._state
            failed_version = ""
            try:
                spec = parse_active_spec(REGISTRY_PATH)
                failed_version = spec.version
                text_pipeline = self._load_pipeline(spec.text_artifact.path)
                image_pipeline = self._load_pipeline(spec.image_artifact.path)
                self._state = LoadedModelState(
                    spec=spec,
                    text_pipeline=text_pipeline,
                    image_pipeline=image_pipeline,
                )
            except Exception as exc:
                if previous_state is None:
                    try:
                        fallback_spec = parse_best_fallback_spec(
                            metadata_path=REGISTRY_PATH,
                            failed_version=failed_version,
                        )
                        text_pipeline = self._load_pipeline(fallback_spec.text_artifact.path)
                        image_pipeline = self._load_pipeline(fallback_spec.image_artifact.path)
                        self._state = LoadedModelState(
                            spec=fallback_spec,
                            text_pipeline=text_pipeline,
                            image_pipeline=image_pipeline,
                        )
                        return
                    except Exception:
                        pass
                if previous_state is not None:
                    self._state = previous_state
                    return
                raise RuntimeError(f"model_load_failed: {exc}") from exc
