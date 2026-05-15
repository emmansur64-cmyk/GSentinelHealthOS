import pandas as pd
import onnxruntime as rt
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report
)
from sklearn.model_selection import StratifiedKFold
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
import joblib
import shutil
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import os
import json
import numpy as np
from datetime import datetime
import sys
from pathlib import Path
import hashlib

# Add scripts to path for imports
sys.path.insert(0, str(Path(__file__).parent))
from model_registry import ModelRegistry
from model_compare import ModelComparison

MIN_PRODUCTION_TOTAL_SAMPLES = 50
MIN_PRODUCTION_SAMPLES_PER_CLASS = 5
DEFAULT_PIPELINE_VERSION = 'ml-pipeline-v1'


def _clamp_probability(value):
    return float(max(1e-6, min(1 - 1e-6, value)))


def _normalize_rows(probabilities):
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


def _multiclass_brier_score(y_true, probabilities, class_count):
    probs = _normalize_rows(probabilities)
    y_true_arr = np.asarray(y_true, dtype=int)
    one_hot = np.zeros((len(y_true_arr), class_count), dtype=float)
    one_hot[np.arange(len(y_true_arr)), y_true_arr] = 1.0
    return float(np.mean(np.sum((probs - one_hot) ** 2, axis=1)))


def _reliability_curve(y_true, probabilities, bins=10):
    probs = _normalize_rows(probabilities)
    y_true_arr = np.asarray(y_true, dtype=int)
    confidence = np.max(probs, axis=1)
    predicted = np.argmax(probs, axis=1)
    correctness = (predicted == y_true_arr).astype(float)

    edges = np.linspace(0.0, 1.0, bins + 1)
    points = []
    ece_accum = 0.0

    for idx in range(bins):
        left = edges[idx]
        right = edges[idx + 1]
        if idx == bins - 1:
            mask = (confidence >= left) & (confidence <= right)
        else:
            mask = (confidence >= left) & (confidence < right)

        count = int(mask.sum())
        if count == 0:
            continue

        avg_conf = float(confidence[mask].mean())
        acc = float(correctness[mask].mean())
        gap = abs(acc - avg_conf)
        ece_accum += gap * (count / len(confidence))
        points.append({
            'bin_start': float(left),
            'bin_end': float(right),
            'avg_confidence': avg_conf,
            'accuracy': acc,
            'gap': float(gap),
            'count': count,
        })

    return {
        'ece': float(ece_accum),
        'points': points,
    }


def fit_platt_calibrator(y_true, raw_probabilities, class_count):
    probs = _normalize_rows(raw_probabilities)
    y_true_arr = np.asarray(y_true, dtype=int)
    params = []

    for class_idx in range(class_count):
        y_binary = (y_true_arr == class_idx).astype(int)
        class_probs = np.clip(probs[:, class_idx], 1e-6, 1 - 1e-6)

        if y_binary.min() == y_binary.max():
            params.append({'type': 'identity', 'a': 1.0, 'b': 0.0})
            continue

        logits = np.log(class_probs / (1.0 - class_probs)).reshape(-1, 1)
        try:
            lr = LogisticRegression(C=1e6, solver='lbfgs', max_iter=2000)
            lr.fit(logits, y_binary)
            params.append({
                'type': 'platt',
                'a': float(lr.coef_[0][0]),
                'b': float(lr.intercept_[0]),
            })
        except Exception:
            params.append({'type': 'identity', 'a': 1.0, 'b': 0.0})

    return {
        'method': 'platt',
        'params': params,
        'class_count': int(class_count),
    }


def apply_platt_calibrator(raw_probabilities, calibrator):
    probs = _normalize_rows(raw_probabilities)
    calibrated = np.zeros_like(probs, dtype=float)
    params = calibrator.get('params', [])

    for class_idx in range(probs.shape[1]):
        class_probs = np.clip(probs[:, class_idx], 1e-6, 1 - 1e-6)
        logits = np.log(class_probs / (1.0 - class_probs))
        param = params[class_idx] if class_idx < len(params) else {'type': 'identity', 'a': 1.0, 'b': 0.0}

        if param.get('type') == 'platt':
            a = float(param.get('a', 1.0))
            b = float(param.get('b', 0.0))
            calibrated[:, class_idx] = 1.0 / (1.0 + np.exp(-(a * logits + b)))
        else:
            calibrated[:, class_idx] = class_probs

    return _normalize_rows(calibrated)


def fit_isotonic_calibrator(y_true, raw_probabilities, class_count):
    probs = _normalize_rows(raw_probabilities)
    y_true_arr = np.asarray(y_true, dtype=int)
    params = []

    for class_idx in range(class_count):
        y_binary = (y_true_arr == class_idx).astype(int)
        class_probs = probs[:, class_idx]

        if y_binary.min() == y_binary.max():
            params.append({'type': 'identity', 'x': [0.0, 1.0], 'y': [0.0, 1.0]})
            continue

        try:
            iso = IsotonicRegression(y_min=0.0, y_max=1.0, out_of_bounds='clip')
            iso.fit(class_probs, y_binary)
            params.append({
                'type': 'isotonic',
                'x': [float(v) for v in iso.X_thresholds_],
                'y': [float(v) for v in iso.y_thresholds_],
            })
        except Exception:
            params.append({'type': 'identity', 'x': [0.0, 1.0], 'y': [0.0, 1.0]})

    return {
        'method': 'isotonic',
        'params': params,
        'class_count': int(class_count),
    }


def apply_isotonic_calibrator(raw_probabilities, calibrator):
    probs = _normalize_rows(raw_probabilities)
    calibrated = np.zeros_like(probs, dtype=float)
    params = calibrator.get('params', [])

    for class_idx in range(probs.shape[1]):
        class_probs = np.clip(probs[:, class_idx], 0.0, 1.0)
        param = params[class_idx] if class_idx < len(params) else {'type': 'identity', 'x': [0.0, 1.0], 'y': [0.0, 1.0]}

        if param.get('type') == 'isotonic':
            x_vals = np.asarray(param.get('x', [0.0, 1.0]), dtype=float)
            y_vals = np.asarray(param.get('y', [0.0, 1.0]), dtype=float)
            if len(x_vals) >= 2 and len(x_vals) == len(y_vals):
                calibrated[:, class_idx] = np.interp(class_probs, x_vals, y_vals)
            else:
                calibrated[:, class_idx] = class_probs
        else:
            calibrated[:, class_idx] = class_probs

    return _normalize_rows(calibrated)


def optimize_confidence_threshold(confidence, correctness, min_precision, fallback):
    confidence_arr = np.asarray(confidence, dtype=float)
    correctness_arr = np.asarray(correctness, dtype=float)

    if len(confidence_arr) == 0:
        return float(fallback)

    thresholds = np.unique(np.round(confidence_arr, 4))
    thresholds.sort()

    best_threshold = None
    min_support = max(5, int(len(confidence_arr) * 0.02))

    for t in thresholds:
        mask = confidence_arr >= t
        support = int(mask.sum())
        if support < min_support:
            continue

        precision = float(correctness_arr[mask].mean())
        if precision >= min_precision:
            best_threshold = float(t)
            break

    if best_threshold is None:
        return float(fallback)

    return float(max(0.0, min(1.0, best_threshold)))


def dynamic_threshold_caps(validation_size):
    """Compute adaptive confidence caps to avoid over-restriction on small validation sets.

    validation_size <= 40  -> max_ml=0.86, max_hybrid=0.74
    validation_size >= 200 -> max_ml=0.95, max_hybrid=0.85
    linear interpolation in-between.
    """
    val_n = int(max(1, validation_size))
    lower_n = 40
    upper_n = 200

    min_ml_cap, max_ml_cap = 0.86, 0.95
    min_hybrid_cap, max_hybrid_cap = 0.74, 0.85

    if val_n <= lower_n:
        ratio = 0.0
    elif val_n >= upper_n:
        ratio = 1.0
    else:
        ratio = (val_n - lower_n) / float(upper_n - lower_n)

    ml_cap = min_ml_cap + (max_ml_cap - min_ml_cap) * ratio
    hybrid_cap = min_hybrid_cap + (max_hybrid_cap - min_hybrid_cap) * ratio
    return float(ml_cap), float(hybrid_cap)


def _sha256_file(path):
    if not os.path.exists(path):
        return None

    digest = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _sha256_text(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def load_processed_metadata():
    metadata_path = 'data/processed/metadata.json'
    if not os.path.exists(metadata_path):
        return {}
    try:
        with open(metadata_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def enforce_dataset_gate(y_train, y_val, y_test):
    metadata = load_processed_metadata()
    dataset_type = str(metadata.get('dataset_type', 'unknown')).lower()

    if dataset_type != 'production':
        print(f"Dataset type: {dataset_type} (production gate not enforced)")
        return

    total_samples = int(metadata.get('total_samples', len(y_train) + len(y_val) + len(y_test)))
    action_counts = metadata.get('action_counts') or {}
    if action_counts:
        min_samples_per_class = int(min(action_counts.values()))
    else:
        y_all = np.concatenate([y_train, y_val, y_test])
        _, counts = np.unique(y_all, return_counts=True)
        min_samples_per_class = int(counts.min()) if len(counts) > 0 else 0

    print(f"Dataset type: production")
    print(f"Production gate - total_samples: {total_samples}, min_samples_per_class: {min_samples_per_class}")

    if total_samples < MIN_PRODUCTION_TOTAL_SAMPLES or min_samples_per_class < MIN_PRODUCTION_SAMPLES_PER_CLASS:
        raise RuntimeError(
            "Production dataset gate failed: "
            f"requires total_samples >= {MIN_PRODUCTION_TOTAL_SAMPLES} and "
            f"min_samples_per_class >= {MIN_PRODUCTION_SAMPLES_PER_CLASS}. "
            f"Observed total_samples={total_samples}, min_samples_per_class={min_samples_per_class}."
        )


def select_cv_folds(y_train):
    """Dynamic CV rule based on samples per class.

    - if samples_per_class >= 10: use k=10
    - if samples_per_class >= 5: use k=5
    - otherwise: disable CV
    """
    if len(y_train) < 2:
        return 0, 0

    _, class_counts = np.unique(y_train, return_counts=True)
    min_class_count = int(class_counts.min()) if len(class_counts) > 0 else 0

    if min_class_count >= 10:
        return 10, min_class_count
    if min_class_count >= 5:
        return 5, min_class_count
    return 0, min_class_count

def calculate_overfitting_score(train_acc, test_acc):
    """Calculate overfitting indicator: difference between train and test accuracy"""
    return train_acc - test_acc


# ---------------------------------------------------------------------------
# DEPLOYMENT GATE
# ---------------------------------------------------------------------------
DEPLOYMENT_GATE_MIN_TEST_ACCURACY = 0.70
DEPLOYMENT_GATE_MAX_OVERFITTING   = 0.30


def evaluate_deployment_gate(
    test_accuracy: float,
    overfitting_score: float,
    cv_available: bool,
    onnx_path: str = 'models/decision_model.onnx',
    pkl_path: str  = 'models/decision_model.pkl',
    X_test_path: str = 'data/processed/X_test.csv',
) -> dict:
    """
    Evaluate minimum reliability conditions before registering a model.

    Conditions
    ----------
    1. test_accuracy  >= 0.70
    2. overfitting_score < 0.30  (train_acc - test_acc)
    3. cv_available  == True     (cross-validation was computed)
    4. ONNX parity   == 1.0      (ONNX predictions identical to sklearn)

    Returns a dict with keys:
      passed       bool  – True only when ALL conditions are satisfied
      checks       dict  – per-condition result
      onnx_parity  float – measured parity rate (0‥1)
      details      list  – human-readable lines for reporting
    """
    checks = {}
    details = []

    # 1. Minimum test accuracy
    checks['test_accuracy'] = test_accuracy >= DEPLOYMENT_GATE_MIN_TEST_ACCURACY
    details.append(
        f"  [{'PASS' if checks['test_accuracy'] else 'FAIL'}] "
        f"test_accuracy={test_accuracy:.4f} "
        f"(required >= {DEPLOYMENT_GATE_MIN_TEST_ACCURACY})"
    )

    # 2. Overfitting within tolerance
    checks['overfitting'] = overfitting_score < DEPLOYMENT_GATE_MAX_OVERFITTING
    details.append(
        f"  [{'PASS' if checks['overfitting'] else 'FAIL'}] "
        f"overfitting_score={overfitting_score:.4f} "
        f"(required < {DEPLOYMENT_GATE_MAX_OVERFITTING})"
    )

    # 3. Cross-validation available
    checks['cv_available'] = bool(cv_available)
    details.append(
        f"  [{'PASS' if checks['cv_available'] else 'FAIL'}] "
        f"cv_available={cv_available}"
    )

    # 4. ONNX parity == 1.0
    onnx_parity = 0.0
    try:
        X_test = pd.read_csv(X_test_path)
        sk_model = joblib.load(pkl_path)
        sess = rt.InferenceSession(onnx_path)
        input_name = sess.get_inputs()[0].name
        sk_pred   = sk_model.predict(X_test)
        ox_out    = sess.run(None, {input_name: X_test.astype(np.float32).to_numpy()})
        onnx_pred = np.array(ox_out[0]).reshape(-1)
        onnx_parity = float((onnx_pred == sk_pred).mean())
        checks['onnx_parity'] = onnx_parity == 1.0
        details.append(
            f"  [{'PASS' if checks['onnx_parity'] else 'FAIL'}] "
            f"onnx_parity={onnx_parity:.4f} (required == 1.0)"
        )
    except Exception as exc:
        checks['onnx_parity'] = False
        details.append(f"  [FAIL] onnx_parity=ERROR ({exc})")

    passed = all(checks.values())
    return {
        'passed': passed,
        'checks': checks,
        'onnx_parity': onnx_parity,
        'details': details,
    }


def compute_feature_importance(model, feature_names, top_n=10):
    """Compute and export global feature importance from RandomForest."""
    importances = np.asarray(model.feature_importances_, dtype=float)
    total = importances.sum()
    if total <= 0:
        total = 1.0

    ranked = sorted(
        [
            {
                'rank': 0,
                'feature': str(feature_names[i]) if i < len(feature_names) else f'f{i}',
                'importance': float(importances[i]),
                'importance_pct': float(importances[i] / total * 100),
            }
            for i in range(len(importances))
        ],
        key=lambda x: x['importance'],
        reverse=True,
    )
    for rank_idx, entry in enumerate(ranked):
        entry['rank'] = rank_idx + 1

    payload = {
        'timestamp': datetime.now().isoformat(),
        'num_features': int(len(importances)),
        'top_n': int(top_n),
        'features': ranked,
        'top_features': ranked[:top_n],
    }

    with open('models/feature_importance.json', 'w') as f:
        json.dump(payload, f, indent=2)
    print('[OK] Saved: models/feature_importance.json')

    return payload


def export_onnx_metadata(X_train, calibration_payload=None, decision_thresholds=None, top_features_global=None):
    """Export ONNX runtime metadata for Node.js inference consistency."""
    feature_names_path = 'data/processed/feature_names.txt'
    model_feature_names_path = 'models/feature_names.txt'
    action_mapping_path = 'data/processed/action_mapping.txt'
    encoders_path = 'models/feature_encoders.pkl'
    action_encoder_path = 'models/action_encoder.pkl'
    metadata_out_path = 'models/onnx_metadata.json'
    processed_metadata = load_processed_metadata()

    feature_names = []
    if os.path.exists(feature_names_path):
        with open(feature_names_path, 'r') as f:
            feature_names = [line.strip() for line in f if line.strip()]

        # Keep a copy in models/ for runtime access in Node.js.
        with open(model_feature_names_path, 'w') as f:
            f.write('\n'.join(feature_names) + ('\n' if feature_names else ''))

    action_classes = []
    if os.path.exists(action_mapping_path):
        with open(action_mapping_path, 'r') as f:
            for line in f:
                parts = line.strip().split(',', 1)
                if len(parts) == 2:
                    action_classes.append(parts[1])

    if not action_classes and os.path.exists(action_encoder_path):
        try:
            action_encoder = joblib.load(action_encoder_path)
            action_classes = [str(x) for x in getattr(action_encoder, 'classes_', [])]
        except Exception:
            action_classes = []

    encoder_mappings = {}
    if os.path.exists(encoders_path):
        try:
            encoders = joblib.load(encoders_path)
            for col, encoder in encoders.items():
                classes = [str(x) for x in getattr(encoder, 'classes_', [])]
                encoder_mappings[col] = {value: idx for idx, value in enumerate(classes)}
        except Exception:
            encoder_mappings = {}

    feature_defaults = {}
    for col in X_train.columns:
        series = X_train[col]
        try:
            feature_defaults[col] = float(series.median())
        except Exception:
            feature_defaults[col] = 0.0

    pipeline_version = str(
        os.getenv('PIPELINE_VERSION')
        or processed_metadata.get('pipeline_version')
        or DEFAULT_PIPELINE_VERSION
    )
    feature_names_hash = _sha256_text('\n'.join(feature_names))
    encoder_hash = _sha256_file(encoders_path)
    action_encoder_hash = _sha256_file(action_encoder_path)
    feature_schema_version = f"{pipeline_version}:{feature_names_hash[:12]}"

    onnx_metadata = {
        'exported_at': datetime.now().isoformat(),
        'pipeline_version': pipeline_version,
        'feature_schema_version': feature_schema_version,
        'feature_names_hash': feature_names_hash,
        'encoder_hash': encoder_hash,
        'action_encoder_hash': action_encoder_hash,
        'num_features': int(X_train.shape[1]),
        'feature_names': feature_names,
        'feature_defaults': feature_defaults,
        'action_classes': action_classes,
        'encoder_mappings': encoder_mappings,
        'calibration': calibration_payload or {'method': 'none', 'class_count': int(len(action_classes)), 'params': []},
        'decision_thresholds': decision_thresholds or {'ml_primary': 0.8, 'hybrid_min': 0.6},
        'top_features_global': top_features_global or [],
    }

    with open(metadata_out_path, 'w') as f:
        json.dump(onnx_metadata, f, indent=2)

    print('Saved: models/feature_names.txt')
    print('Saved: models/onnx_metadata.json')

    return {
        'pipeline_version': pipeline_version,
        'feature_schema_version': feature_schema_version,
        'feature_names': feature_names,
        'feature_names_hash': feature_names_hash,
        'encoder_hash': encoder_hash,
        'action_encoder_hash': action_encoder_hash,
        'num_features': int(X_train.shape[1]),
    }

def train_model():
    # Load data
    X_train = pd.read_csv('data/processed/X_train.csv')
    y_train = pd.read_csv('data/processed/y_train.csv').values.ravel()
    X_val = pd.read_csv('data/processed/X_val.csv')
    y_val = pd.read_csv('data/processed/y_val.csv').values.ravel()
    X_test = pd.read_csv('data/processed/X_test.csv')
    y_test = pd.read_csv('data/processed/y_test.csv').values.ravel()

    enforce_dataset_gate(y_train, y_val, y_test)

    print(f"\n{'='*70}")
    print(f"MetaBrain ML Model Training - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}")
    print(f"Dataset Info:")
    print(f"  Train size: {X_train.shape[0]} samples, {X_train.shape[1]} features")
    print(f"  Validation size: {X_val.shape[0]} samples")
    print(f"  Test size: {X_test.shape[0]} samples")
    print(f"  Classes: {len(np.unique(y_train))}")
    print(f"  Class distribution (train): {np.bincount(y_train.astype(int))}")
    print(f"{'='*70}\n")

    # Train model
    print("Training RandomForestClassifier...")
    model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)
    print("[OK] Model trained\n")

    # === TRAINING SET EVALUATION ===
    print(f"{'='*70}")
    print("TRAINING SET METRICS")
    print(f"{'='*70}")
    y_train_pred = model.predict(X_train)
    train_accuracy = accuracy_score(y_train, y_train_pred)
    train_precision = precision_score(y_train, y_train_pred, average='weighted', zero_division=0)
    train_recall = recall_score(y_train, y_train_pred, average='weighted', zero_division=0)
    train_f1 = f1_score(y_train, y_train_pred, average='weighted', zero_division=0)

    print(f"Accuracy:  {train_accuracy:.4f}")
    print(f"Precision: {train_precision:.4f}")
    print(f"Recall:    {train_recall:.4f}")
    print(f"F1-Score:  {train_f1:.4f}\n")

    # === VALIDATION SET EVALUATION ===
    print(f"{'='*70}")
    print("VALIDATION SET METRICS")
    print(f"{'='*70}")
    y_val_pred = model.predict(X_val)
    val_raw_probabilities = _normalize_rows(model.predict_proba(X_val))
    val_accuracy = accuracy_score(y_val, y_val_pred)
    val_precision = precision_score(y_val, y_val_pred, average='weighted', zero_division=0)
    val_recall = recall_score(y_val, y_val_pred, average='weighted', zero_division=0)
    val_f1 = f1_score(y_val, y_val_pred, average='weighted', zero_division=0)

    print(f"Accuracy:  {val_accuracy:.4f}")
    print(f"Precision: {val_precision:.4f}")
    print(f"Recall:    {val_recall:.4f}")
    print(f"F1-Score:  {val_f1:.4f}\n")

    # === CROSS-VALIDATION ===
    print(f"{'='*70}")
    print("CROSS-VALIDATION ANALYSIS (k-fold)")
    print(f"{'='*70}")
    cv_folds, min_samples_per_class = select_cv_folds(y_train)
    cv_available = False
    cv_consistency_threshold = 0.10
    cv_consistent = False
    cv_results = {}

    print(f"Min samples per class: {min_samples_per_class}")
    if cv_folds == 10:
        print("CV rule applied: samples_per_class >= 10 -> using k=10")
    elif cv_folds == 5:
        print("CV rule applied: samples_per_class >= 5 -> using k=5")
    else:
        print("CV rule applied: samples_per_class < 5 -> CV disabled")

    if cv_folds > 1:
        from sklearn.model_selection import cross_validate
        from sklearn.metrics import make_scorer

        # Define multiple scorers
        scorers = {
            'accuracy': 'accuracy',
            'precision': make_scorer(precision_score, average='weighted', zero_division=0),
            'recall': make_scorer(recall_score, average='weighted', zero_division=0),
            'f1': make_scorer(f1_score, average='weighted', zero_division=0)
        }

        # Stratified K-Fold for imbalanced datasets
        skf = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)
        cv_results = cross_validate(model, X_train, y_train, cv=skf, scoring=scorers, n_jobs=-1)
        cv_available = True

        # Extract results
        cv_accuracy_scores = cv_results['test_accuracy']
        cv_precision_scores = cv_results['test_precision']
        cv_recall_scores = cv_results['test_recall']
        cv_f1_scores = cv_results['test_f1']

        # Calculate means and stds
        cv_accuracy_mean = cv_accuracy_scores.mean()
        cv_accuracy_std = cv_accuracy_scores.std()
        cv_precision_mean = cv_precision_scores.mean()
        cv_precision_std = cv_precision_scores.std()
        cv_recall_mean = cv_recall_scores.mean()
        cv_recall_std = cv_recall_scores.std()
        cv_f1_mean = cv_f1_scores.mean()
        cv_f1_std = cv_f1_scores.std()

        print(f"K-Fold Cross-Validation (k={cv_folds}):")
        print(f"{'Fold':<4} {'Accuracy':<10} {'Precision':<10} {'Recall':<10} {'F1-Score':<10}")
        print("-" * 50)
        for i in range(cv_folds):
            print(f"{i+1:<4} {cv_accuracy_scores[i]:<10.4f} {cv_precision_scores[i]:<10.4f} {cv_recall_scores[i]:<10.4f} {cv_f1_scores[i]:<10.4f}")
        print("-" * 50)
        print(f"Mean: {cv_accuracy_mean:.4f} ± {cv_accuracy_std:.4f}    {cv_precision_mean:.4f} ± {cv_precision_std:.4f}    {cv_recall_mean:.4f} ± {cv_recall_std:.4f}    {cv_f1_mean:.4f} ± {cv_f1_std:.4f}")

        # Overall CV stability (use accuracy as primary metric)
        cv_mean = cv_accuracy_mean
        cv_std = cv_accuracy_std
        cv_consistent = cv_accuracy_std <= cv_consistency_threshold
        consistency_status = "CONSISTENT" if cv_consistent else "HIGH VARIANCE"
        print(f"Consistency: {consistency_status} (accuracy std <= {cv_consistency_threshold:.2f})")
    else:
        print("Cross-validation unavailable: samples_per_class is below 5")
        cv_mean = 0.0
        cv_std = 0.0
    print()

    # === TEST SET EVALUATION ===
    print(f"{'='*70}")
    print("TEST SET METRICS (Final Evaluation)")
    print(f"{'='*70}")
    y_test_pred = model.predict(X_test)
    test_raw_probabilities = _normalize_rows(model.predict_proba(X_test))
    test_accuracy = accuracy_score(y_test, y_test_pred)
    test_precision = precision_score(y_test, y_test_pred, average='weighted', zero_division=0)
    test_recall = recall_score(y_test, y_test_pred, average='weighted', zero_division=0)
    test_f1 = f1_score(y_test, y_test_pred, average='weighted', zero_division=0)

    print(f"Accuracy:  {test_accuracy:.4f}")
    print(f"Precision: {test_precision:.4f}")
    print(f"Recall:    {test_recall:.4f}")
    print(f"F1-Score:  {test_f1:.4f}\n")

    # === PROBABILITY CALIBRATION ===
    print(f"{'='*70}")
    print("PROBABILITY CALIBRATION")
    print(f"{'='*70}")
    class_count = len(np.unique(y_train))

    platt_calibrator = fit_platt_calibrator(y_val, val_raw_probabilities, class_count)
    isotonic_calibrator = fit_isotonic_calibrator(y_val, val_raw_probabilities, class_count)

    val_platt_probabilities = apply_platt_calibrator(val_raw_probabilities, platt_calibrator)
    val_isotonic_probabilities = apply_isotonic_calibrator(val_raw_probabilities, isotonic_calibrator)

    val_raw_brier = _multiclass_brier_score(y_val, val_raw_probabilities, class_count)
    val_platt_brier = _multiclass_brier_score(y_val, val_platt_probabilities, class_count)
    val_isotonic_brier = _multiclass_brier_score(y_val, val_isotonic_probabilities, class_count)

    val_raw_reliability = _reliability_curve(y_val, val_raw_probabilities)
    val_platt_reliability = _reliability_curve(y_val, val_platt_probabilities)
    val_isotonic_reliability = _reliability_curve(y_val, val_isotonic_probabilities)

    calibration_candidates = {
        'raw': {
            'probabilities': val_raw_probabilities,
            'brier': val_raw_brier,
            'ece': val_raw_reliability['ece'],
            'calibrator': {'method': 'none', 'class_count': class_count, 'params': []},
        },
        'platt': {
            'probabilities': val_platt_probabilities,
            'brier': val_platt_brier,
            'ece': val_platt_reliability['ece'],
            'calibrator': platt_calibrator,
        },
        'isotonic': {
            'probabilities': val_isotonic_probabilities,
            'brier': val_isotonic_brier,
            'ece': val_isotonic_reliability['ece'],
            'calibrator': isotonic_calibrator,
        },
    }

    selected_method = min(calibration_candidates.keys(), key=lambda key: calibration_candidates[key]['brier'])
    selected_entry = calibration_candidates[selected_method]
    selected_calibrator = selected_entry['calibrator']

    print(f"Validation Brier score (raw):      {val_raw_brier:.6f}")
    print(f"Validation Brier score (platt):    {val_platt_brier:.6f}")
    print(f"Validation Brier score (isotonic): {val_isotonic_brier:.6f}")
    print(f"Validation ECE (raw):      {val_raw_reliability['ece']:.6f}")
    print(f"Validation ECE (platt):    {val_platt_reliability['ece']:.6f}")
    print(f"Validation ECE (isotonic): {val_isotonic_reliability['ece']:.6f}")
    print(f"Selected calibration method: {selected_method}\n")

    if selected_method == 'platt':
        calibrated_test_probabilities = apply_platt_calibrator(test_raw_probabilities, selected_calibrator)
    elif selected_method == 'isotonic':
        calibrated_test_probabilities = apply_isotonic_calibrator(test_raw_probabilities, selected_calibrator)
    else:
        calibrated_test_probabilities = test_raw_probabilities

    test_raw_brier = _multiclass_brier_score(y_test, test_raw_probabilities, class_count)
    test_calibrated_brier = _multiclass_brier_score(y_test, calibrated_test_probabilities, class_count)
    test_raw_reliability = _reliability_curve(y_test, test_raw_probabilities)
    test_calibrated_reliability = _reliability_curve(y_test, calibrated_test_probabilities)

    print(f"Test Brier score (raw):       {test_raw_brier:.6f}")
    print(f"Test Brier score (calibrated): {test_calibrated_brier:.6f}")
    print(f"Test ECE (raw):       {test_raw_reliability['ece']:.6f}")
    print(f"Test ECE (calibrated): {test_calibrated_reliability['ece']:.6f}\n")

    val_selected_probabilities = selected_entry['probabilities']
    val_selected_confidence = np.max(val_selected_probabilities, axis=1)
    val_selected_correct = (np.argmax(val_selected_probabilities, axis=1) == y_val).astype(float)

    ml_primary_threshold = optimize_confidence_threshold(
        val_selected_confidence,
        val_selected_correct,
        min_precision=0.85,
        fallback=0.8,
    )
    hybrid_threshold = optimize_confidence_threshold(
        val_selected_confidence,
        val_selected_correct,
        min_precision=0.70,
        fallback=0.6,
    )

    if hybrid_threshold >= ml_primary_threshold:
        hybrid_threshold = max(0.5, ml_primary_threshold - 0.1)

    # Keep thresholds in an operational range and adapt caps by validation set size.
    ml_cap, hybrid_cap = dynamic_threshold_caps(len(y_val))
    ml_primary_threshold = max(0.70, min(ml_cap, ml_primary_threshold))
    hybrid_threshold = max(0.55, min(hybrid_cap, hybrid_threshold))
    if hybrid_threshold >= ml_primary_threshold:
        hybrid_threshold = max(0.55, ml_primary_threshold - 0.1)

    decision_thresholds = {
        'ml_primary': _clamp_probability(ml_primary_threshold),
        'hybrid_min': _clamp_probability(hybrid_threshold),
        'caps': {
            'ml_primary_max': float(ml_cap),
            'hybrid_min_max': float(hybrid_cap),
            'validation_size': int(len(y_val)),
        },
    }
    print(
        f"Decision thresholds: ml_primary>={decision_thresholds['ml_primary']:.3f}, "
        f"hybrid_min>={decision_thresholds['hybrid_min']:.3f} "
        f"(caps: ml_max={ml_cap:.3f}, hybrid_max={hybrid_cap:.3f}, val_n={len(y_val)})\n"
    )

    calibration_report = {
        'timestamp': datetime.now().isoformat(),
        'selected_method': selected_method,
        'class_count': int(class_count),
        'validation': {
            'raw': {
                'brier': float(val_raw_brier),
                'ece': float(val_raw_reliability['ece']),
                'calibration_curve': val_raw_reliability['points'],
            },
            'platt': {
                'brier': float(val_platt_brier),
                'ece': float(val_platt_reliability['ece']),
                'calibration_curve': val_platt_reliability['points'],
            },
            'isotonic': {
                'brier': float(val_isotonic_brier),
                'ece': float(val_isotonic_reliability['ece']),
                'calibration_curve': val_isotonic_reliability['points'],
            },
        },
        'test': {
            'raw': {
                'brier': float(test_raw_brier),
                'ece': float(test_raw_reliability['ece']),
                'calibration_curve': test_raw_reliability['points'],
            },
            'calibrated': {
                'brier': float(test_calibrated_brier),
                'ece': float(test_calibrated_reliability['ece']),
                'calibration_curve': test_calibrated_reliability['points'],
            },
        },
        'decision_thresholds': decision_thresholds,
    }

    # === CONFUSION MATRIX ===
    print(f"{'='*70}")
    print("CONFUSION MATRIX (Test Set)")
    print(f"{'='*70}")
    cm = confusion_matrix(y_test, y_test_pred)
    print(cm)
    print()

    # === CLASSIFICATION REPORT ===
    print(f"{'='*70}")
    print("DETAILED CLASSIFICATION REPORT (Test Set)")
    print(f"{'='*70}")
    print(classification_report(y_test, y_test_pred, zero_division=0))
    print()

    # === OVERFITTING ANALYSIS ===
    print(f"{'='*70}")
    print("OVERFITTING ANALYSIS")
    print(f"{'='*70}")
    overfitting_score = calculate_overfitting_score(train_accuracy, test_accuracy)

    print(f"Train Accuracy: {train_accuracy:.4f}")
    print(f"Test Accuracy:  {test_accuracy:.4f}")
    print(f"Difference:     {overfitting_score:.4f}")

    if overfitting_score < 0.05:
        status = "[OK] NO OVERFITTING (Good generalization)"
    elif overfitting_score < 0.15:
        status = "⚠ SLIGHT OVERFITTING (Acceptable)"
    elif overfitting_score < 0.30:
        status = "⚠ MODERATE OVERFITTING (Needs improvement)"
    else:
        status = "✗ SEVERE OVERFITTING (Model not reliable)"

    print(f"Status: {status}\n")

    # === MODEL COMPARISON WITH PREVIOUS ===
    print(f"{'='*70}")
    print("MODEL VERSIONING")
    print(f"{'='*70}")
    prev_accuracy = 0.0
    prev_metrics = {}

    if os.path.exists('models/model_metrics.json'):
        try:
            with open('models/model_metrics.json', 'r') as f:
                content = f.read().strip()
                if content:
                    prev_metrics = json.loads(content)
                    prev_accuracy = prev_metrics.get('test_accuracy', 0.0)
        except json.JSONDecodeError:
            prev_accuracy = 0.0

    if prev_accuracy > 0:
        print(f"Previous Model Accuracy: {prev_accuracy:.4f}")
        print(f"Current Model Accuracy:  {test_accuracy:.4f}")

        prev_brier = prev_metrics.get('calibration_brier_test_selected')
        if isinstance(prev_brier, (int, float)):
            calibration_improved = float(test_calibrated_brier) < float(prev_brier)
        else:
            calibration_improved = float(test_calibrated_brier) < float(test_raw_brier)

        if test_accuracy >= prev_accuracy:
            improvement = ((test_accuracy - prev_accuracy) / prev_accuracy * 100) if prev_accuracy > 0 else 0
            print(f"Improvement: +{improvement:.2f}%")
            should_save = True
        else:
            degradation = ((prev_accuracy - test_accuracy) / prev_accuracy * 100) if prev_accuracy > 0 else 0
            print(f"Degradation: -{degradation:.2f}%")
            within_accuracy_tolerance = degradation <= 3.0
            should_save = bool(within_accuracy_tolerance and calibration_improved)
            if should_save:
                if isinstance(prev_brier, (int, float)):
                    print(
                        "Saving due to better calibrated confidence: "
                        f"test_brier improved from {float(prev_brier):.6f} to {float(test_calibrated_brier):.6f} "
                        f"with accuracy degradation within tolerance ({degradation:.2f}% <= 3.00%)."
                    )
                else:
                    print(
                        "Saving due to better calibrated confidence: "
                        f"test_brier improved from raw {float(test_raw_brier):.6f} to calibrated {float(test_calibrated_brier):.6f} "
                        f"with accuracy degradation within tolerance ({degradation:.2f}% <= 3.00%)."
                    )
    else:
        print("No previous model found - this is the first training")
        should_save = True

    print()

    # === SAVE DECISION ===
    if should_save:
        print(f"{'='*70}")
        print("SAVING MODEL")
        print(f"{'='*70}")

        # Save model
        joblib.dump(model, 'models/decision_model.pkl')
        print("[OK] Saved: models/decision_model.pkl")

        # Convert to ONNX
        initial_type = [('float_input', FloatTensorType([None, X_train.shape[1]]))]
        onx = convert_sklearn(model, initial_types=initial_type)
        with open('models/decision_model.onnx', 'wb') as f:
            f.write(onx.SerializeToString())
        print("[OK] Saved: models/decision_model.onnx")

        # Export runtime metadata for Node.js ONNX inference
        feature_importance_payload = compute_feature_importance(
            model, list(X_train.columns), top_n=10
        )
        schema_info = export_onnx_metadata(
            X_train,
            calibration_payload=selected_calibrator,
            decision_thresholds=decision_thresholds,
            top_features_global=feature_importance_payload['top_features'],
        )

        # Keep stable artifact aliases expected by runtime/docs.
        if os.path.exists('models/feature_scaler.pkl'):
            shutil.copyfile('models/feature_scaler.pkl', 'models/scaler.pkl')
            print('[OK] Saved: models/scaler.pkl')
        if os.path.exists('models/feature_encoders.pkl'):
            print('[OK] Found: models/feature_encoders.pkl')
        if os.path.exists('models/action_encoder.pkl'):
            print('[OK] Found: models/action_encoder.pkl')

        # Save comprehensive metrics
        metrics = {
            'timestamp': datetime.now().isoformat(),
            'train_accuracy': float(train_accuracy),
            'train_precision': float(train_precision),
            'train_recall': float(train_recall),
            'train_f1': float(train_f1),
            'val_accuracy': float(val_accuracy),
            'val_precision': float(val_precision),
            'val_recall': float(val_recall),
            'val_f1': float(val_f1),
            'test_accuracy': float(test_accuracy),
            'test_precision': float(test_precision),
            'test_recall': float(test_recall),
            'test_f1': float(test_f1),
            'cv_available': bool(cv_available),
            'cv_folds_used': int(cv_folds),
            'cv_accuracy_mean': float(cv_accuracy_mean) if cv_folds > 1 else 0.0,
            'cv_accuracy_std': float(cv_accuracy_std) if cv_folds > 1 else 0.0,
            'cv_precision_mean': float(cv_precision_mean) if cv_folds > 1 else 0.0,
            'cv_precision_std': float(cv_precision_std) if cv_folds > 1 else 0.0,
            'cv_recall_mean': float(cv_recall_mean) if cv_folds > 1 else 0.0,
            'cv_recall_std': float(cv_recall_std) if cv_folds > 1 else 0.0,
            'cv_f1_mean': float(cv_f1_mean) if cv_folds > 1 else 0.0,
            'cv_f1_std': float(cv_f1_std) if cv_folds > 1 else 0.0,
            'cv_consistency_threshold': float(cv_consistency_threshold),
            'cv_consistent': bool(cv_consistent),
            'cv_mean': float(cv_mean),
            'cv_std': float(cv_std),
            'overfitting_score': float(overfitting_score),
            'num_features': int(X_train.shape[1]),
            'pipeline_version': schema_info['pipeline_version'],
            'feature_schema_version': schema_info['feature_schema_version'],
            'feature_names_hash': schema_info['feature_names_hash'],
            'encoder_hash': schema_info['encoder_hash'],
            'action_encoder_hash': schema_info['action_encoder_hash'],
            'feature_names': schema_info['feature_names'],
            'num_train_samples': int(X_train.shape[0]),
            'num_val_samples': int(X_val.shape[0]),
            'num_test_samples': int(X_test.shape[0]),
            'calibration_method': selected_method,
            'calibration_brier_val_raw': float(val_raw_brier),
            'calibration_brier_val_selected': float(selected_entry['brier']),
            'calibration_ece_val_raw': float(val_raw_reliability['ece']),
            'calibration_ece_val_selected': float(selected_entry['ece']),
            'calibration_brier_test_raw': float(test_raw_brier),
            'calibration_brier_test_selected': float(test_calibrated_brier),
            'calibration_ece_test_raw': float(test_raw_reliability['ece']),
            'calibration_ece_test_selected': float(test_calibrated_reliability['ece']),
            'ml_primary_threshold': float(decision_thresholds['ml_primary']),
            'hybrid_min_threshold': float(decision_thresholds['hybrid_min']),
        }

        with open('models/model_metrics.json', 'w') as f:
            json.dump(metrics, f, indent=2)
        print("[OK] Saved: models/model_metrics.json")

        with open('models/calibration_report.json', 'w') as f:
            json.dump(calibration_report, f, indent=2)
        print("[OK] Saved: models/calibration_report.json")

        # Save confusion matrix
        cm_dict = {
            'confusion_matrix': cm.tolist(),
            'true_positives': int(np.trace(cm)),
            'false_positives': int(cm.sum() - np.trace(cm) - (cm.sum(axis=0) - np.diag(cm)).sum()),
        }
        with open('models/confusion_matrix.json', 'w') as f:
            json.dump(cm_dict, f, indent=2)
        print("[OK] Saved: models/confusion_matrix.json")

        # === DEPLOYMENT GATE ===
        print(f"\n{'='*70}")
        print("DEPLOYMENT GATE")
        print(f"{'='*70}")

        gate_result = evaluate_deployment_gate(
            test_accuracy=test_accuracy,
            overfitting_score=overfitting_score,
            cv_available=cv_available,
        )

        for line in gate_result['details']:
            print(line)

        gate_report = {
            'timestamp': datetime.now().isoformat(),
            'passed': gate_result['passed'],
            'checks': gate_result['checks'],
            'onnx_parity': gate_result['onnx_parity'],
            'test_accuracy': float(test_accuracy),
            'overfitting_score': float(overfitting_score),
            'cv_available': bool(cv_available),
        }
        os.makedirs('models/reports', exist_ok=True)
        with open('models/reports/deployment_gate_report.json', 'w') as f:
            json.dump(gate_report, f, indent=2)

        if not gate_result['passed']:
            print(f"\n[DEPLOYMENT BLOCKED] Model does not meet minimum reliability conditions.")
            print(f"[DEPLOYMENT BLOCKED] Artifacts saved for inspection but NOT registered.")
            print(f"[DEPLOYMENT BLOCKED] Report: models/reports/deployment_gate_report.json")
            print(f"\n[OK] Model saved successfully (blocked from registry)\n")
            print(f"{'='*70}\n")
            return

        print(f"\n[DEPLOYMENT GATE PASSED] Model meets all reliability conditions.")

        # === REGISTER WITH MODEL REGISTRY ===
        print(f"\n{'='*70}")
        print("MODEL REGISTRY")
        print(f"{'='*70}")

        try:
            registry = ModelRegistry('models/registry.json')
            version = registry.register_model(
                metrics,
                notes="Automatic training with validation"
            )

            # === COMPARE WITH PRODUCTION ===
            print(f"\n{'='*70}")
            print("DEPLOYMENT RECOMMENDATION")
            print(f"{'='*70}\n")

            comparator = ModelComparison('models/registry.json')
            recommendation = comparator.recommend_deployment(version)
            comparator.print_recommendation(recommendation)

            # Save recommendation
            os.makedirs('models/reports', exist_ok=True)
            with open(f'models/reports/recommendation_{version}.json', 'w') as f:
                json.dump(recommendation, f, indent=2)
            print(f"[OK] Recommendation saved to models/reports/recommendation_{version}.json")

            # Print summary
            print(f"\n{'='*70}")
            print("TRAINING SUMMARY")
            print(f"{'='*70}\n")
            registry.print_summary()
            registry.print_history()

        except Exception as e:
            print(f"⚠ Registry error: {e}")

        print(f"\n[OK] Model saved successfully\n")
    else:
        print(f"✗ New model not better than previous - not saving\n")

    print(f"{'='*70}\n")

if __name__ == '__main__':
    train_model()
