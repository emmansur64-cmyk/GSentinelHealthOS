"""
Comprehensive Model Validation Script for MetaBrain ML
Detects overfitting, validates performance, and generates quality report
"""

import json
import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, roc_auc_score, precision_recall_curve
)
import joblib
from datetime import datetime

def load_metrics():
    """Load current and previous metrics"""
    if not os.path.exists('models/model_metrics.json'):
        return None

    try:
        with open('models/model_metrics.json', 'r') as f:
            return json.load(f)
    except:
        return None

def validate_overfitting(metrics):
    """Validate overfitting status"""
    if not metrics:
        return None

    train_acc = metrics.get('train_accuracy', 0)
    test_acc = metrics.get('test_accuracy', 0)
    overfit_score = metrics.get('overfitting_score', train_acc - test_acc)

    result = {
        'train_accuracy': train_acc,
        'test_accuracy': test_acc,
        'difference': overfit_score,
    }

    if overfit_score < 0.05:
        result['status'] = 'EXCELLENT'
        result['message'] = '✓ No overfitting detected - good generalization'
    elif overfit_score < 0.15:
        result['status'] = 'GOOD'
        result['message'] = '✓ Slight overfitting - acceptable for production'
    elif overfit_score < 0.30:
        result['status'] = 'WARNING'
        result['message'] = '⚠ Moderate overfitting - monitor in production'
    else:
        result['status'] = 'CRITICAL'
        result['message'] = '✗ Severe overfitting - model not reliable'

    return result

def validate_metrics(metrics):
    """Validate metric thresholds"""
    if not metrics:
        return None

    test_acc = metrics.get('test_accuracy', 0)
    test_prec = metrics.get('test_precision', 0)
    test_rec = metrics.get('test_recall', 0)
    test_f1 = metrics.get('test_f1', 0)
    cv_available = metrics.get('cv_available', False)
    cv_acc_std = metrics.get('cv_accuracy_std', 0)
    cv_acc_mean = metrics.get('cv_accuracy_mean', 0)

    checks = {
        'accuracy_50': test_acc >= 0.50,
        'accuracy_70': test_acc >= 0.70,
        'accuracy_85': test_acc >= 0.85,
        'precision_consistent': test_prec >= test_acc * 0.9,
        'recall_consistent': test_rec >= test_acc * 0.9,
        'f1_consistency': abs(test_acc - test_f1) < 0.15,
        'cv_available': bool(cv_available),
        'cv_stable': bool(cv_available) and (cv_acc_std < 0.10),
        'cv_high': bool(cv_available) and (cv_acc_mean >= 0.60),
    }

    return checks

def generate_validation_report():
    """Generate comprehensive validation report"""

    print(f"\n{'='*80}")
    print(f"MODEL VALIDATION REPORT - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}\n")

    metrics = load_metrics()

    if not metrics:
        print("❌ No model metrics found. Train a model first.")
        return False

    # 1. OVERFITTING CHECK
    print(f"{'─'*80}")
    print("1. OVERFITTING VALIDATION")
    print(f"{'─'*80}")

    overfit_check = validate_overfitting(metrics)
    print(f"Status: {overfit_check['status']}")
    print(f"  Train Accuracy: {overfit_check['train_accuracy']:.4f}")
    print(f"  Test Accuracy:  {overfit_check['test_accuracy']:.4f}")
    print(f"  Difference:     {overfit_check['difference']:.4f}")
    print(f"  {overfit_check['message']}\n")

    # 2. METRIC VALIDATION
    print(f"{'─'*80}")
    print("2. PERFORMANCE METRICS VALIDATION")
    print(f"{'─'*80}")

    checks = validate_metrics(metrics)

    print(f"Test Metrics:")
    print(f"  Accuracy:  {metrics.get('test_accuracy', 0):.4f} (min 0.50)")
    print(f"  Precision: {metrics.get('test_precision', 0):.4f}")
    print(f"  Recall:    {metrics.get('test_recall', 0):.4f}")
    print(f"  F1-Score:  {metrics.get('test_f1', 0):.4f}")
    print()

    print(f"Cross-Validation (Train, k-fold):")
    cv_available = metrics.get('cv_available', False)
    cv_folds_used = metrics.get('cv_folds_used', 0)
    cv_acc_mean = metrics.get('cv_accuracy_mean', 0)
    cv_acc_std = metrics.get('cv_accuracy_std', 0)
    cv_prec_mean = metrics.get('cv_precision_mean', 0)
    cv_prec_std = metrics.get('cv_precision_std', 0)
    cv_rec_mean = metrics.get('cv_recall_mean', 0)
    cv_rec_std = metrics.get('cv_recall_std', 0)
    cv_f1_mean = metrics.get('cv_f1_mean', 0)
    cv_f1_std = metrics.get('cv_f1_std', 0)

    if cv_available:
        print(f"  Folds used: {cv_folds_used}")
        print(f"  Accuracy:  {cv_acc_mean:.4f} ± {cv_acc_std:.4f}")
        print(f"  Precision: {cv_prec_mean:.4f} ± {cv_prec_std:.4f}")
        print(f"  Recall:    {cv_rec_mean:.4f} ± {cv_rec_std:.4f}")
        print(f"  F1-Score:  {cv_f1_mean:.4f} ± {cv_f1_std:.4f}")

        # Model consistency check
        consistency_threshold = 0.10  # Max acceptable std
        is_consistent = cv_acc_std <= consistency_threshold
        consistency_status = "✓ CONSISTENT" if is_consistent else "⚠ HIGH VARIANCE"
        print(f"  Consistency: {consistency_status} (std ≤ {consistency_threshold})")
    else:
        print("  No cross-validation data available")

    cv_stability = "N/A (INSUFFICIENT DATA)" if not cv_available else ("✓ STABLE" if checks['cv_stable'] else "⚠ HIGH VARIANCE")
    print(f"  Overall Status: {cv_stability}\n")

    # 3. SANITY CHECKS
    print(f"{'─'*80}")
    print("3. SANITY CHECKS")
    print(f"{'─'*80}")

    all_pass = True
    for check_name, result in checks.items():
        status = "✓" if result else "✗"
        check_label = check_name.replace('_', ' ').title()
        print(f"  {status} {check_label}: {result}")
        if not result:
            all_pass = False

    print()

    # 4. PRODUCTION READINESS
    print(f"{'─'*80}")
    print("4. PRODUCTION READINESS")
    print(f"{'─'*80}")

    readiness_score = 0

    # Score based on overfitting
    if overfit_check['status'] in ['EXCELLENT', 'GOOD']:
        readiness_score += 40
    elif overfit_check['status'] == 'WARNING':
        readiness_score += 20

    # Score based on test accuracy
    test_acc = metrics.get('test_accuracy', 0)
    if test_acc >= 0.85:
        readiness_score += 30
    elif test_acc >= 0.70:
        readiness_score += 20
    elif test_acc >= 0.50:
        readiness_score += 10

    # Score based on CV stability
    cv_acc_std = metrics.get('cv_accuracy_std', 0)
    if cv_available:
        if cv_acc_std <= 0.05:
            readiness_score += 20  # Very consistent
        elif cv_acc_std <= 0.10:
            readiness_score += 15  # Consistent
        elif checks['cv_stable']:
            readiness_score += 10  # Moderately stable
        elif checks['cv_high']:
            readiness_score += 5   # Some stability

    # Score based on metrics consistency
    consistency_pass = checks['precision_consistent'] and checks['recall_consistent']
    if consistency_pass:
        readiness_score += 10

    # Hard gate: without CV evidence, do not mark model as production ready.
    if not checks['cv_available']:
        readiness_score = min(readiness_score, 59)

    print(f"Readiness Score: {readiness_score}/100")

    if readiness_score >= 80:
        recommendation = "✓ READY FOR PRODUCTION"
        color = "GREEN"
    elif readiness_score >= 60:
        recommendation = "⚠ CAUTION - Monitor in production"
        color = "YELLOW"
    elif readiness_score >= 40:
        recommendation = "⚠ LIMITED - Use with restrictions"
        color = "ORANGE"
    else:
        recommendation = "✗ NOT READY - Needs improvement"
        color = "RED"

    print(f"Recommendation: {recommendation}\n")

    # 5. DATASET INFO
    print(f"{'─'*80}")
    print("5. DATASET & MODEL INFO")
    print(f"{'─'*80}")
    print(f"  Features:      {metrics.get('num_features', 'N/A')}")
    print(f"  Train Samples: {metrics.get('num_train_samples', 'N/A')}")
    print(f"  Test Samples:  {metrics.get('num_test_samples', 'N/A')}")
    print(f"  Timestamp:     {metrics.get('timestamp', 'N/A')}\n")

    # 6. RECOMMENDATIONS
    print(f"{'─'*80}")
    print("6. RECOMMENDATIONS")
    print(f"{'─'*80}")

    recommendations = []

    if not checks['accuracy_70']:
        recommendations.append("• Increase training data or re-engineer features")

    if overfit_check['difference'] > 0.20:
        recommendations.append("• Reduce model complexity or add regularization")
        recommendations.append("• Increase training set size if possible")

    if not checks['cv_available']:
        recommendations.append("• Cross-validation could not run (insufficient class/sample support for k=5 or k=10)")
        recommendations.append("• Increase training data per class to validate robustness")
    elif not checks['cv_stable']:
        recommendations.append("• Cross-validation shows high variance")
        recommendations.append("• Model consistency needs improvement")
        recommendations.append("• Collect more diverse training data")
        recommendations.append("• Consider feature engineering or regularization")

    if checks['f1_consistency']:
        recommendations.append("• Metric distribution is consistent - good sign")
    else:
        recommendations.append("• Check for class imbalance in data")

    if not recommendations:
        recommendations.append("• Model looks good - monitor in production")
        recommendations.append("• Perform regular retraining with new data")

    for rec in recommendations:
        print(rec)

    print(f"\n{'='*80}\n")

    return readiness_score >= 60, readiness_score

if __name__ == '__main__':
    is_ready, score = generate_validation_report()
    exit(0 if is_ready else 1)
