from __future__ import annotations

import json
from pathlib import Path

import joblib
from sklearn.feature_extraction import DictVectorizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from cerebro_ai_med.models.registry import compute_sha256, ensure_semver, utc_now_iso
from cerebro_ai_med.models.training_data import build_image_dataset, build_text_dataset


ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
REGISTRY_PATH = ARTIFACT_DIR / "metadata.json"
LEGACY_METADATA_PATH = ARTIFACT_DIR / "model_metadata.json"
MODEL_VERSION = "3.0.0"


def _train_text_pipeline() -> tuple[Pipeline, dict[str, float]]:
    dataset = build_text_dataset()
    x_train, x_test, y_train, y_test = train_test_split(
        dataset.texts,
        dataset.labels,
        test_size=0.25,
        random_state=42,
        stratify=dataset.labels,
    )

    pipeline = Pipeline(
        [
            ("vectorizer", TfidfVectorizer(ngram_range=(1, 2), min_df=1, max_features=6000)),
            (
                "classifier",
                LogisticRegression(
                    max_iter=1500,
                    C=1.8,
                    class_weight="balanced",
                    random_state=42,

                ),
            ),
        ]
    )
    pipeline.fit(x_train, y_train)

    y_pred = pipeline.predict(x_test)
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    metrics = {
        "accuracy": float(round(accuracy_score(y_test, y_pred), 6)),
        "macro_f1": float(round(report["macro avg"]["f1-score"], 6)),
        "weighted_f1": float(round(report["weighted avg"]["f1-score"], 6)),
    }
    return pipeline, metrics


def _train_image_pipeline() -> tuple[Pipeline, dict[str, float]]:
    dataset = build_image_dataset(seed=42, n_per_class=260)
    x_train, x_test, y_train, y_test = train_test_split(
        dataset.features,
        dataset.labels,
        test_size=0.25,
        random_state=42,
        stratify=dataset.labels,
    )

    pipeline = Pipeline(
        [
            ("vectorizer", DictVectorizer(sparse=False)),
            (
                "classifier",
                LogisticRegression(
                    max_iter=1200,
                    C=1.5,
                    class_weight="balanced",
                    random_state=42,

                ),
            ),
        ]
    )
    pipeline.fit(x_train, y_train)

    y_pred = pipeline.predict(x_test)
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    metrics = {
        "accuracy": float(round(accuracy_score(y_test, y_pred), 6)),
        "macro_f1": float(round(report["macro avg"]["f1-score"], 6)),
        "weighted_f1": float(round(report["weighted avg"]["f1-score"], 6)),
    }
    return pipeline, metrics


def train_and_save_models() -> dict[str, object]:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    version = ensure_semver(MODEL_VERSION)

    text_dir = ARTIFACT_DIR / "text" / version
    image_dir = ARTIFACT_DIR / "image" / version
    text_dir.mkdir(parents=True, exist_ok=True)
    image_dir.mkdir(parents=True, exist_ok=True)

    text_model_path = text_dir / "text_risk_pipeline.joblib"
    image_model_path = image_dir / "image_risk_pipeline.joblib"

    text_pipeline, text_metrics = _train_text_pipeline()
    image_pipeline, image_metrics = _train_image_pipeline()

    joblib.dump(text_pipeline, text_model_path)
    joblib.dump(image_pipeline, image_model_path)

    text_sha = compute_sha256(text_model_path)
    image_sha = compute_sha256(image_model_path)

    model_entry: dict[str, object] = {
        "version": version,
        "created_at": utc_now_iso(),
        "model_family": "sklearn-logistic-regression",
        "labels": ["low", "medium", "high"],
        "artifacts": {
            "text": {
                "path": str(text_model_path),
                "sha256": text_sha,
            },
            "image": {
                "path": str(image_model_path),
                "sha256": image_sha,
            },
        },
        "metrics": {
            "text": text_metrics,
            "image": image_metrics,
        },
    }

    registry: dict[str, object]
    if REGISTRY_PATH.exists():
        try:
            registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            registry = {"active_model": version, "models": []}
    else:
        registry = {"active_model": version, "models": []}

    models = registry.get("models", [])
    if not isinstance(models, list):
        models = []

    models = [item for item in models if str(item.get("version", "")) != version]
    models.append(model_entry)

    registry["active_model"] = version
    registry["models"] = models
    REGISTRY_PATH.write_text(json.dumps(registry, indent=2), encoding="utf-8")

    legacy_metadata = {
        "model_family": model_entry["model_family"],
        "model_version": version,
        "labels": model_entry["labels"],
        "artifacts": {
            "text": str(text_model_path),
            "image": str(image_model_path),
        },
        "checksums": {
            "text": text_sha,
            "image": image_sha,
        },
        "metrics": model_entry["metrics"],
    }
    LEGACY_METADATA_PATH.write_text(json.dumps(legacy_metadata, indent=2), encoding="utf-8")
    return legacy_metadata


if __name__ == "__main__":
    result = train_and_save_models()
    print(json.dumps(result, indent=2))
