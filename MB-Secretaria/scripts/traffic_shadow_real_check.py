import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ROOT / "models"
PROCESSED_DIR = ROOT / "data" / "processed"


def normalize_rows(probabilities: np.ndarray) -> np.ndarray:
    probs = np.asarray(probabilities, dtype=float)
    if probs.ndim != 2 or probs.shape[0] == 0:
        return probs

    probs = np.nan_to_num(probs, nan=0.0, posinf=0.0, neginf=0.0)
    probs = np.clip(probs, 0.0, None)
    row_sums = probs.sum(axis=1, keepdims=True)

    zero_rows = np.where(row_sums[:, 0] <= 0)[0]
    if len(zero_rows) > 0:
        probs[zero_rows, :] = 1.0 / probs.shape[1]
        row_sums = probs.sum(axis=1, keepdims=True)

    return probs / row_sums


def interpolate(value: float, x_vals: list[float], y_vals: list[float]) -> float:
    if value <= x_vals[0]:
        return y_vals[0]
    if value >= x_vals[-1]:
        return y_vals[-1]

    for idx in range(1, len(x_vals)):
        if value <= x_vals[idx]:
            x0 = x_vals[idx - 1]
            x1 = x_vals[idx]
            y0 = y_vals[idx - 1]
            y1 = y_vals[idx]
            width = x1 - x0
            if width <= 0:
                return y0
            ratio = (value - x0) / width
            return y0 + ratio * (y1 - y0)

    return y_vals[-1]


def apply_calibration(probabilities: np.ndarray, calibration: dict) -> np.ndarray:
    probs = normalize_rows(probabilities)
    if probs.shape[0] == 0:
        return probs

    method = calibration.get("method", "none")
    params = calibration.get("params", [])
    calibrated = np.zeros_like(probs, dtype=float)

    for class_idx in range(probs.shape[1]):
        class_probs = np.clip(probs[:, class_idx], 1e-6, 1 - 1e-6)
        param = params[class_idx] if class_idx < len(params) else {"type": "identity"}

        if method == "platt" and param.get("type") == "platt":
            a = float(param.get("a", 1.0))
            b = float(param.get("b", 0.0))
            logits = np.log(class_probs / (1.0 - class_probs))
            calibrated[:, class_idx] = 1.0 / (1.0 + np.exp(-(a * logits + b)))
        elif method == "isotonic" and param.get("type") == "isotonic":
            x_vals = [float(x) for x in param.get("x", [0.0, 1.0])]
            y_vals = [float(y) for y in param.get("y", [0.0, 1.0])]
            if len(x_vals) >= 2 and len(x_vals) == len(y_vals):
                calibrated[:, class_idx] = np.array(
                    [interpolate(float(p), x_vals, y_vals) for p in class_probs],
                    dtype=float,
                )
            else:
                calibrated[:, class_idx] = class_probs
        else:
            calibrated[:, class_idx] = class_probs

    return normalize_rows(calibrated)


def source_distribution(confidence: np.ndarray, ml_primary: float, hybrid_min: float) -> dict:
    ml_mask = confidence >= ml_primary
    hybrid_mask = (confidence >= hybrid_min) & (confidence < ml_primary)
    rules_mask = confidence < hybrid_min

    total = float(len(confidence))
    return {
        "ML": {
            "count": int(ml_mask.sum()),
            "ratio": float(ml_mask.sum() / total if total else 0.0),
        },
        "HYBRID": {
            "count": int(hybrid_mask.sum()),
            "ratio": float(hybrid_mask.sum() / total if total else 0.0),
        },
        "RULES": {
            "count": int(rules_mask.sum()),
            "ratio": float(rules_mask.sum() / total if total else 0.0),
        },
    }


def format_distribution(title: str, distribution: dict) -> str:
    lines = [title]
    for key in ["ML", "HYBRID", "RULES"]:
        item = distribution[key]
        lines.append(f"  {key:<6} count={item['count']:<4} ratio={item['ratio']:.2%}")
    return "\n".join(lines)


def run() -> None:
    model_path = MODELS_DIR / "decision_model.pkl"
    metadata_path = MODELS_DIR / "onnx_metadata.json"
    x_val_path = PROCESSED_DIR / "X_val.csv"
    x_test_path = PROCESSED_DIR / "X_test.csv"

    model = joblib.load(model_path)
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

    calibration = metadata.get("calibration", {"method": "none", "params": []})
    thresholds = metadata.get("decision_thresholds", {})
    ml_primary = float(thresholds.get("ml_primary", 0.8))
    hybrid_min = float(thresholds.get("hybrid_min", 0.6))

    x_val = pd.read_csv(x_val_path)
    x_test = pd.read_csv(x_test_path)

    val_probs = apply_calibration(model.predict_proba(x_val), calibration)
    test_probs = apply_calibration(model.predict_proba(x_test), calibration)

    val_conf = np.max(val_probs, axis=1)
    test_conf = np.max(test_probs, axis=1)

    val_dist = source_distribution(val_conf, ml_primary=ml_primary, hybrid_min=hybrid_min)
    test_dist = source_distribution(test_conf, ml_primary=ml_primary, hybrid_min=hybrid_min)

    report = {
        "thresholds": {
            "ml_primary": ml_primary,
            "hybrid_min": hybrid_min,
        },
        "calibration_method": calibration.get("method", "none"),
        "shadow_mode": {
            "description": "Decisions logged only; no action execution.",
            "validation_distribution": val_dist,
            "test_distribution": test_dist,
        },
        "real_mode": {
            "description": "Same decision sources, with execution enabled by downstream gate.",
            "validation_distribution": val_dist,
            "test_distribution": test_dist,
            "execution_candidates": {
                "validation": int(val_dist["ML"]["count"] + val_dist["HYBRID"]["count"]),
                "test": int(test_dist["ML"]["count"] + test_dist["HYBRID"]["count"]),
            },
        },
    }

    output_path = MODELS_DIR / "traffic_shadow_real_report.json"
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("Traffic real/shadow check completed")
    print(f"Calibration method: {report['calibration_method']}")
    print(f"Thresholds: ml_primary={ml_primary:.3f}, hybrid_min={hybrid_min:.3f}")
    print(format_distribution("Validation distribution", val_dist))
    print(format_distribution("Test distribution", test_dist))
    print(f"Saved report: {output_path}")


if __name__ == "__main__":
    run()
