#!/usr/bin/env python3
"""
Feature Analysis & Importance Scoring
Analyzes the enriched dataset and shows which features are most valuable
"""

import pandas as pd
import numpy as np
import json
import os
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
import warnings
warnings.filterwarnings('ignore')

def load_feature_names():
    """Load feature names from file"""
    with open('data/processed/feature_names.txt') as f:
        return [line.strip() for line in f]

def analyze_features():
    """Analyze feature engineering results"""
    print("=" * 80)
    print("FEATURE ANALYSIS: ML Feature Importance & Correlation")
    print("=" * 80)
    
    # Check if datasets exist
    if not os.path.exists('data/processed/X_train.csv'):
        print("\nERROR: Training data not found!")
        print("Run: python scripts/data_pipeline.py")
        return
    
    # Load data
    print("\nLoading datasets...")
    X_train = pd.read_csv('data/processed/X_train.csv')
    y_train = pd.read_csv('data/processed/y_train.csv')
    feature_names = load_feature_names()
    
    print(f"✓ Loaded {X_train.shape[0]} training samples, {X_train.shape[1]} features")
    
    # === FEATURE STATISTICS ===
    print("\n" + "=" * 80)
    print("FEATURE STATISTICS")
    print("=" * 80)
    
    numeric_cols = X_train.select_dtypes(include=[np.number]).columns
    stats = X_train[numeric_cols].describe().T
    
    print("\nTop Features by Variance (most informative):")
    variance = X_train[numeric_cols].var().sort_values(ascending=False)
    for feat, var in variance[variance > 0].head(10).items():
        print(f"  {feat:40s}: variance={var:.6f}")
    
    low_var = variance[variance < 0.001]
    if len(low_var) > 0:
        print(f"\nLow-variance features ({len(low_var)}):")
        for feat, var in low_var.items():
            print(f"  {feat:40s}: variance={var:.6f}")
    else:
        print("\n✓ No low-variance features detected")
    
    # === FEATURE IMPORTANCE (if model exists) ===
    print("\n" + "=" * 80)
    print("FEATURE IMPORTANCE ANALYSIS")
    print("=" * 80)
    
    if os.path.exists('models/decision_model.pkl'):
        try:
            import joblib
            model = joblib.load('models/decision_model.pkl')
            
            importance_df = pd.DataFrame({
                'feature': feature_names,
                'importance': model.feature_importances_
            }).sort_values('importance', ascending=False)
            
            print("\nTop 20 Most Important Features:")
            print("-" * 80)
            for idx, row in importance_df.head(20).iterrows():
                bar_length = int(row['importance'] * 50)
                bar = "█" * bar_length
                print(f"{row['feature']:40s} {row['importance']:6.4f} {bar}")
            
            # Save importance
            importance_df.to_csv('models/feature_importance_analysis.csv', index=False)
            print("\n✓ Feature importance saved to models/feature_importance_analysis.csv")
        except Exception as e:
            print(f"Warning: Could not load model - {e}")
            print("Run: python scripts/train_model.py first")
    else:
        print("Model not found. Run: python scripts/train_model.py")
    
    # === FEATURE CATEGORIES ===
    print("\n" + "=" * 80)
    print("FEATURE CATEGORIES SUMMARY")
    print("=" * 80)
    
    # Categorize features
    temporal_features = [f for f in feature_names if any(x in f for x in 
                        ['hour', 'day', 'month', 'time_since', 'incidents_', 'rolling'])]
    historical_features = [f for f in feature_names if any(x in f for x in 
                         ['success_rate', 'failure_rate', 'last_action', 'action_', 'retry', 'effectiveness'])]
    context_features = [f for f in feature_names if any(x in f for x in 
                      ['logs_count', 'metrics_count', 'has_data', 'severity'])]
    categorical_features = [f for f in feature_names if '_encoded' in f]
    
    print(f"\nTemporal Features ({len(temporal_features)}):")
    for f in temporal_features[:5]:
        print(f"  ✓ {f}")
    if len(temporal_features) > 5:
        print(f"  ... and {len(temporal_features)-5} more")
    
    print(f"\nHistorical Features ({len(historical_features)}):")
    for f in historical_features[:5]:
        print(f"  ✓ {f}")
    if len(historical_features) > 5:
        print(f"  ... and {len(historical_features)-5} more")
    
    print(f"\nContext Features ({len(context_features)}):")
    for f in context_features:
        print(f"  ✓ {f}")
    
    print(f"\nCategorical Features ({len(categorical_features)}):")
    for f in categorical_features[:9]:
        print(f"  ✓ {f}")
    
    # === SUMMARY ===
    print("\n" + "=" * 80)
    print("DATA QUALITY SUMMARY")
    print("=" * 80)
    
    print(f"\nDataset Shape: {X_train.shape}")
    print(f"Null Values: {X_train.isnull().sum().sum()}")
    print(f"Duplicated Rows: {X_train.duplicated().sum()}")
    print(f"Memory Usage: {X_train.memory_usage(deep=True).sum() / 1024:.2f} KB")
    
    print(f"\nFeature Breakdown:")
    print(f"  Temporal:       {len(temporal_features):2d} features")
    print(f"  Historical:     {len(historical_features):2d} features")
    print(f"  Context:        {len(context_features):2d} features")
    print(f"  Categorical:    {len(categorical_features):2d} features (encoded)")
    print(f"  Total:          {len(feature_names):2d} features")
    
    print("\n" + "=" * 80)
    print("✓ FEATURE ENGINEERING COMPLETE")
    print("=" * 80)

if __name__ == '__main__':
    analyze_features()
