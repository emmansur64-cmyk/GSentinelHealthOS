#!/usr/bin/env python3
"""
Incremental Model Training for MetaBrain
Trains a new model using historical data + online feedback buffer

Usage:
    python train_model_incremental.py <buffer_csv_path>
"""

import sys
import os
import json
import argparse
from pathlib import Path

import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.preprocessing import LabelEncoder
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
import joblib
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

# Import from main training script
sys.path.insert(0, str(Path(__file__).parent))
from train_model import (
    evaluate_deployment_gate,
    compute_feature_importance,
    export_onnx_metadata,
    calculate_overfitting_score,
    dynamic_threshold_caps,
    DEPLOYMENT_GATE_MIN_TEST_ACCURACY,
    DEPLOYMENT_GATE_MAX_OVERFITTING,
)
from model_registry import ModelRegistry


def load_historical_data():
    """Load the historical training dataset"""
    X_train_path = Path('data/processed/X_train.csv')
    y_train_path = Path('data/processed/y_train.csv')
    X_test_path = Path('data/processed/X_test.csv')
    y_test_path = Path('data/processed/y_test.csv')

    if not all([X_train_path.exists(), y_train_path.exists()]):
        raise FileNotFoundError('Historical training data not found')

    X_train = pd.read_csv(X_train_path)
    y_train = pd.read_csv(y_train_path).squeeze()
    X_test = pd.read_csv(X_test_path) if X_test_path.exists() else None
    y_test = pd.read_csv(y_test_path).squeeze() if y_test_path.exists() else None

    return X_train, y_train, X_test, y_test


def load_incremental_data(buffer_csv_path):
    """Load incremental feedback from buffer CSV"""
    if not Path(buffer_csv_path).exists():
        raise FileNotFoundError(f'Buffer CSV not found: {buffer_csv_path}')

    df = pd.read_csv(buffer_csv_path)
    
    # Separate features from target
    feature_cols = [c for c in df.columns if c not in ['incidentId', 'source', 'outcome', 'executed', 'target_action']]
    X_incremental = df[feature_cols]
    y_incremental = df['target_action']
    
    print(f'[OnlineLearning] Loaded {len(X_incremental)} incremental records from buffer')
    return X_incremental, y_incremental


def combine_datasets(X_train, y_train, X_incremental, y_incremental):
    """Combine historical and incremental datasets"""
    # Ensure feature alignment
    common_cols = set(X_train.columns) & set(X_incremental.columns)
    X_train_aligned = X_train[list(common_cols)]
    X_incremental_aligned = X_incremental[list(common_cols)]
    
    X_combined = pd.concat([X_train_aligned, X_incremental_aligned], ignore_index=True)
    y_combined = pd.concat([y_train, y_incremental], ignore_index=True, keys=[0, 1])
    
    print(f'[OnlineLearning] Combined dataset: {len(X_combined)} records, {len(X_combined.columns)} features')
    return X_combined, y_combined, list(common_cols)


def train_incremental_model(X, y, feature_names):
    """Train model with combined historical + incremental data"""
    print('[OnlineLearning] Training RandomForest with incremental data...')
    
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    
    model.fit(X, y)
    
    # Cross-validation
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scorers = {
        'accuracy': 'accuracy',
        'precision_weighted': 'precision_weighted',
        'recall_weighted': 'recall_weighted',
        'f1_weighted': 'f1_weighted',
    }
    cv_results = cross_validate(model, X, y, cv=skf, scoring=scorers, n_jobs=-1)
    
    cv_accuracy_mean = cv_results['test_accuracy'].mean()
    cv_accuracy_std = cv_results['test_accuracy'].std()
    
    print(f'[OnlineLearning] CV Accuracy: {cv_accuracy_mean:.4f} ± {cv_accuracy_std:.4f}')
    
    return model, cv_accuracy_mean, cv_accuracy_std


def evaluate_incremental_model(model, X_test, y_test):
    """Evaluate on held-out test set"""
    if X_test is None or y_test is None:
        return None, None, None, None
    
    y_pred = model.predict(X_test)
    test_accuracy = accuracy_score(y_test, y_pred)
    test_precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
    test_recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
    test_f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
    
    return test_accuracy, test_precision, test_recall, test_f1


def main(buffer_csv_path):
    """Main incremental training pipeline"""
    print(f'{"="*70}')
    print('Incremental Model Training - MetaBrain Online Learning')
    print(f'{"="*70}\n')
    
    # Step 1: Load historical + incremental data
    try:
        X_train_hist, y_train_hist, X_test, y_test = load_historical_data()
        X_incr, y_incr = load_incremental_data(buffer_csv_path)
        X_combined, y_combined, feature_names = combine_datasets(
            X_train_hist, y_train_hist, X_incr, y_incr
        )
    except Exception as e:
        print(f'[ERROR] Data loading failed: {e}')
        return
    
    # Step 2: Train incremental model
    try:
        model, cv_mean, cv_std = train_incremental_model(X_combined, y_combined, feature_names)
    except Exception as e:
        print(f'[ERROR] Training failed: {e}')
        return
    
    # Step 3: Evaluate on test set
    test_accuracy, test_precision, test_recall, test_f1 = evaluate_incremental_model(
        model, X_test, y_test
    )
    
    if test_accuracy is None:
        print('[WARNING] No test set available for evaluation')
        test_accuracy = cv_mean
        train_accuracy = cv_mean
    else:
        train_accuracy = model.score(X_combined, y_combined)
        print(f'[OnlineLearning] Test Accuracy: {test_accuracy:.4f}')
    
    overfitting_score = calculate_overfitting_score(train_accuracy, test_accuracy)
    
    # Step 4: Deployment gate
    print(f'\n{"="*70}')
    print('DEPLOYMENT GATE')
    print(f'{"="*70}\n')
    
    gate_result = evaluate_deployment_gate(
        test_accuracy=test_accuracy,
        overfitting_score=overfitting_score,
        cv_available=True,
        onnx_path='models/decision_model.onnx',
        pkl_path='models/decision_model.pkl',
        X_test_path='data/processed/X_test.csv',
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
        'cv_available': True,
        'incremental_records': len(X_incr),
        'total_training_records': len(X_combined),
    }
    
    os.makedirs('models/reports', exist_ok=True)
    with open('models/reports/incremental_gate_report.json', 'w') as f:
        json.dump(gate_report, f, indent=2)
    
    if not gate_result['passed']:
        print(f'\n[DEPLOYMENT BLOCKED] Model does not meet minimum reliability.')
        print(f'[DEPLOYMENT BLOCKED] Report: models/reports/incremental_gate_report.json')
        print(f'\nGATE_RESULT:{json.dumps(gate_report)}END_GATE_RESULT')
        return
    
    print(f'\n[DEPLOYMENT GATE PASSED] Model meets reliability conditions.')
    
    # Step 5: Export artifacts
    print(f'\n{"="*70}')
    print('SAVING INCREMENTAL MODEL')
    print(f'{"="*70}\n')
    
    try:
        # Save pickle
        joblib.dump(model, 'models/decision_model.pkl')
        print('[OK] Saved: models/decision_model.pkl')
        
        # Convert to ONNX
        initial_type = [('float_input', FloatTensorType([None, X_combined.shape[1]]))]
        onx = convert_sklearn(model, initial_types=initial_type)
        with open('models/decision_model.onnx', 'wb') as f:
            f.write(onx.SerializeToString())
        print('[OK] Saved: models/decision_model.onnx')
        
        # Export metadata
        feature_importance = compute_feature_importance(model, list(X_combined.columns), top_n=10)
        
        # Dynamic thresholds
        validation_size = len(X_incr)
        decision_thresholds = dynamic_threshold_caps(validation_size)
        decision_thresholds['caps'] = {
            'ml_primary_max': decision_thresholds['ml_primary'],
            'hybrid_min_max': decision_thresholds['hybrid_min'],
            'validation_size': validation_size,
        }
        
        schema_info = export_onnx_metadata(
            X_combined,
            decision_thresholds=decision_thresholds,
            top_features_global=feature_importance['top_features'],
        )
        print('[OK] Updated metadata')
        
        # Register in model registry
        registry = ModelRegistry('models/registry.json')
        metrics = {
            'test_accuracy': float(test_accuracy),
            'test_precision': float(test_precision) if test_precision else 0.0,
            'test_recall': float(test_recall) if test_recall else 0.0,
            'test_f1': float(test_f1) if test_f1 else 0.0,
            'cv_accuracy_mean': float(cv_mean),
            'cv_accuracy_std': float(cv_std),
            'overfitting_score': float(overfitting_score),
            'incremental_samples': len(X_incr),
        }
        
        version = registry.register_model(
            metrics,
            notes=f'Incremental training: {len(X_incr)} online feedback records'
        )
        print(f'[OK] Registered as version {version}')
        
        print(f'\n[OK] Incremental model saved successfully\n')
        print(f'DEPLOYMENT_GATE_PASSED')
        print(f'GATE_RESULT:{json.dumps(gate_report)}END_GATE_RESULT')
        
    except Exception as e:
        print(f'[ERROR] Failed to save model: {e}')
        print(f'\nGATE_RESULT:{json.dumps(gate_report)}END_GATE_RESULT')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Incremental model training')
    parser.add_argument('buffer_csv', help='Path to buffer CSV from online learning')
    args = parser.parse_args()
    
    main(args.buffer_csv)
