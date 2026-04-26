from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import onnxruntime as ort


def load_metadata(model_dir: Path) -> dict:
    with (model_dir / 'anomaly_model_metadata.json').open('r', encoding='utf-8') as handle:
        return json.load(handle)


def evaluate(model_dir: Path, data_dir: Path, output_path: Path) -> None:
    metadata = load_metadata(model_dir)
    threshold = float(metadata.get('anomaly_threshold', 0.0))
    means = np.asarray(metadata.get('feature_means', []), dtype=np.float32)
    stds = np.asarray(metadata.get('feature_stds', []), dtype=np.float32)
    stds = np.where(stds < 1e-6, 1.0, stds)

    sequences = np.load(data_dir / 'X_sequences.npy').astype(np.float32)
    normal_mask = np.load(data_dir / 'normal_mask.npy').astype(bool)
    normalized = ((sequences - means) / stds).astype(np.float32)

    session = ort.InferenceSession(str(model_dir / 'anomaly_model.onnx'))
    input_name = session.get_inputs()[0].name
    outputs = session.run(None, {input_name: normalized})
    reconstruction_error = np.asarray(outputs[1], dtype=np.float32).reshape(-1)
    anomaly_pred = reconstruction_error > threshold

    normal_scores = reconstruction_error[normal_mask]
    anomaly_scores = reconstruction_error[~normal_mask] if np.any(~normal_mask) else np.asarray([], dtype=np.float32)

    report = {
        'num_sequences': int(len(sequences)),
        'threshold': threshold,
        'normal_score_mean': float(np.mean(normal_scores)) if len(normal_scores) else 0.0,
        'normal_score_p95': float(np.quantile(normal_scores, 0.95)) if len(normal_scores) else 0.0,
        'anomaly_score_mean': float(np.mean(anomaly_scores)) if len(anomaly_scores) else 0.0,
        'predicted_anomaly_rate': float(np.mean(anomaly_pred)),
        'false_positive_rate': float(np.mean(normal_scores > threshold)) if len(normal_scores) else 0.0,
        'true_positive_rate': float(np.mean(anomaly_scores > threshold)) if len(anomaly_scores) else 0.0,
        'score_quantiles': {
            'p50': float(np.quantile(reconstruction_error, 0.50)),
            'p95': float(np.quantile(reconstruction_error, 0.95)),
            'p99': float(np.quantile(reconstruction_error, 0.99)),
        },
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open('w', encoding='utf-8') as handle:
        json.dump(report, handle, indent=2)

    print('DL anomaly evaluation complete')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    evaluate(
        model_dir=Path('models'),
        data_dir=Path('data/processed'),
        output_path=Path('models/monitoring/anomaly_detection_report.json'),
    )
