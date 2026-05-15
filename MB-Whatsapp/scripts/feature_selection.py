#!/usr/bin/env python3
"""
Feature Selection & Optimization
Removes irrelevant features based on importance, correlation, and redundancy analysis
"""

import pandas as pd
import numpy as np
import json
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score, StratifiedKFold
import joblib
import warnings
warnings.filterwarnings('ignore')

def calculate_feature_importance_theoretically(feature_names):
    """
    Calculate theoretical feature importance based on feature categories
    For use when we have insufficient training data for actual RF importance
    """

    importance_scores = {}

    # Theoretical importance scores based on feature type and relevance
    # Higher scores = more important

    for feat in feature_names:
        score = 0.0

        # Temporal features (good predictive value)
        if 'hour_of_day' in feat:
            score = 0.08  # Time patterns matter
        elif 'day_of_week' in feat:
            score = 0.07
        elif 'month' in feat:
            score = 0.04

        # Temporal windows (high value - captures state)
        elif 'incidents_last' in feat:
            if '1h' in feat:
                score = 0.12  # Recent incidents very predictive
            elif '24h' in feat:
                score = 0.10
            elif '7d' in feat:
                score = 0.06
        elif 'rolling_frequency' in feat:
            score = 0.09  # Pattern detection

        # Historical success rates (very important - learning signal)
        elif 'success_rate' in feat:
            if 'last_10' in feat:
                score = 0.14  # Recent success/failure is critical
            elif 'today' in feat:
                score = 0.13
            else:
                score = 0.11  # Global success rate

        elif 'failure_rate' in feat:
            score = 0.12  # Failure patterns critical

        # Action effectiveness (high value)
        elif 'action_effectiveness' in feat or 'action_historical' in feat:
            score = 0.13

        # Behavioral flags (escalation detection)
        elif 'escalation_flag' in feat:
            score = 0.08
        elif 'retry_count' in feat and 'normalized' not in feat:
            score = 0.09

        # Context features (moderate)
        elif 'logs_count' in feat:
            score = 0.06
        elif 'metrics_count' in feat:
            score = 0.05
        elif 'has_data' in feat:
            score = 0.04
        elif 'severity' in feat and '_encoded' not in feat:
            score = 0.07

        # Categorical features (moderate)
        elif '_encoded' in feat:
            if 'incident_type' in feat:
                score = 0.08
            elif 'diagnosis' in feat:
                score = 0.10  # Diagnosis is key
            elif 'strategy' in feat:
                score = 0.09
            elif 'source' in feat:
                score = 0.05
            else:
                score = 0.06

        # Normalized features (often redundant with raw)
        elif 'normalized' in feat:
            score = score * 0.5  # Reduce importance of normalized versions

        # Time since features
        elif 'time_since' in feat:
            if 'normalized' not in feat:
                score = 0.10
            else:
                score = 0.07

        # Last action features
        elif 'last_action' in feat:
            score = 0.08

        # Default low score for unmatched
        if score == 0:
            score = 0.03

        importance_scores[feat] = score

    # Normalize to sum to 1
    total = sum(importance_scores.values())
    for feat in importance_scores:
        importance_scores[feat] = importance_scores[feat] / total if total > 0 else 0

    return importance_scores

def train_importance_model(X_train, y_train, feature_names):
    """Train RandomForest to get feature importance"""

    # Check if we have enough data
    if len(np.unique(y_train)) < 2:
        print("⚠ Only 1 class in training data - using theoretical feature importance\n")
        importance_scores = calculate_feature_importance_theoretically(feature_names)
        return None, importance_scores

    if len(X_train) < 10:
        print("⚠ Limited training data (<10 samples) - using theoretical feature importance\n")
        importance_scores = calculate_feature_importance_theoretically(feature_names)
        return None, importance_scores

    print("Training RandomForest for feature importance...")

    model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=10)
    model.fit(X_train, y_train)

    importance_scores = {
        feature_names[i]: model.feature_importances_[i]
        for i in range(len(feature_names))
    }

    print("✓ Model trained\n")
    return model, importance_scores

def analyze_feature_importance(importance_scores, feature_names):
    """Analyze and rank features by importance"""

    importance_df = pd.DataFrame({
        'feature': list(importance_scores.keys()),
        'importance': list(importance_scores.values()),
    })

    importance_df['importance_pct'] = importance_df['importance'] * 100
    importance_df = importance_df.sort_values('importance_pct', ascending=False)

    return importance_df

def analyze_feature_correlation(X):
    """Analyze feature correlations to detect redundancy"""

    # Only numeric columns
    X_numeric = X.select_dtypes(include=[np.number])

    if len(X_numeric.columns) < 2:
        print("Not enough numeric features for correlation analysis")
        return None, []

    print("Analyzing feature correlations...")

    # Calculate correlation matrix
    corr_matrix = X_numeric.corr()

    # Find highly correlated pairs (>0.8)
    high_corr_pairs = []
    for i in range(len(corr_matrix.columns)):
        for j in range(i + 1, len(corr_matrix.columns)):
            corr_val = corr_matrix.iloc[i, j]
            if abs(corr_val) > 0.8:
                high_corr_pairs.append({
                    'feature1': corr_matrix.columns[i],
                    'feature2': corr_matrix.columns[j],
                    'correlation': corr_val
                })

    return corr_matrix, high_corr_pairs

def identify_redundant_features(importance_df, high_corr_pairs, threshold=0.01):
    """Identify features to remove based on importance and correlation"""

    print("\n" + "="*80)
    print("FEATURE SELECTION ANALYSIS")
    print("="*80)

    # 1. Low importance features (bottom 20% or below threshold)
    low_importance_threshold = threshold
    low_importance = importance_df[importance_df['importance_pct'] < low_importance_threshold]['feature'].tolist()

    print(f"\n1. LOW IMPORTANCE FEATURES (< {low_importance_threshold*100:.2f}%):")
    if low_importance:
        for feat in low_importance:
            imp = importance_df[importance_df['feature'] == feat]['importance_pct'].values[0]
            print(f"   ✗ {feat:40s} ({imp:.4f}%)")
    else:
        print("   (None - all features have sufficient importance)")

    # 2. Redundant features (highly correlated)
    print(f"\n2. REDUNDANT FEATURE PAIRS (correlation > 0.80):")
    redundant_to_remove = set()
    if high_corr_pairs:
        shown = 0
        for pair in sorted(high_corr_pairs, key=lambda x: abs(x['correlation']), reverse=True):
            if shown >= 10:
                break
            print(f"   ⚠ {pair['feature1']:35s} <-> {pair['feature2']:35s}: {pair['correlation']:+.3f}")

            # Keep feature with higher importance, remove the other
            if pair['feature1'] in importance_df['feature'].values and pair['feature2'] in importance_df['feature'].values:
                imp1 = importance_df[importance_df['feature'] == pair['feature1']]['importance_pct'].values[0]
                imp2 = importance_df[importance_df['feature'] == pair['feature2']]['importance_pct'].values[0]

                if imp1 < imp2:
                    redundant_to_remove.add(pair['feature1'])
                else:
                    redundant_to_remove.add(pair['feature2'])

            shown += 1
    else:
        print("   (None - no highly correlated features)")

    # 3. Combine candidates for removal
    features_to_remove = set(low_importance) | redundant_to_remove

    print(f"\n3. FEATURES RECOMMENDED FOR REMOVAL:")
    if features_to_remove:
        print(f"   Total: {len(features_to_remove)} features")
        for feat in sorted(features_to_remove):
            if feat in importance_df['feature'].values:
                imp = importance_df[importance_df['feature'] == feat]['importance_pct'].values[0]
                print(f"   - {feat:40s} (importance: {imp:.4f}%)")
            else:
                print(f"   - {feat:40s} (importance: N/A)")
    else:
        print("   (None recommended - all features seem valuable)")

    return features_to_remove

def feature_selection():
    """Main feature selection pipeline"""

    print("\n" + "="*80)
    print("FEATURE SELECTION & OPTIMIZATION PIPELINE")
    print("="*80)

    # Load data
    print("\nLoading datasets...")
    X_train = pd.read_csv('data/processed/X_train.csv')
    X_test = pd.read_csv('data/processed/X_test.csv')
    y_train = pd.read_csv('data/processed/y_train.csv').values.ravel()
    y_test = pd.read_csv('data/processed/y_test.csv').values.ravel()

    with open('data/processed/feature_names.txt') as f:
        feature_names = [line.strip() for line in f]

    print(f"✓ Loaded {X_train.shape[0]} train, {X_test.shape[0]} test samples")
    print(f"✓ {len(feature_names)} features")

    # === FEATURE IMPORTANCE ANALYSIS ===
    print("\n" + "-"*80)
    print("STEP 1: Feature Importance Analysis")
    print("-"*80)

    model, importance_scores = train_importance_model(X_train, y_train, feature_names)
    importance_df = analyze_feature_importance(importance_scores, feature_names)

    print("\nTop 20 Most Important Features:")
    print("-"*80)
    for idx, row in importance_df.head(20).iterrows():
        bar = "█" * int(row['importance_pct'] / 2)
        print(f"{row['feature']:40s} {row['importance_pct']:6.2f}% {bar}")

    print("\nBottom 10 Least Important Features:")
    print("-"*80)
    for idx, row in importance_df.tail(10).iterrows():
        bar = "▌" * max(1, int(row['importance_pct'] / 2))
        print(f"{row['feature']:40s} {row['importance_pct']:6.2f}% {bar}")

    # Save importance ranking
    importance_df.to_csv('models/feature_importance_ranking.csv', index=False)
    print(f"\n✓ Feature importance saved to models/feature_importance_ranking.csv")

    # === CORRELATION ANALYSIS ===
    print("\n" + "-"*80)
    print("STEP 2: Correlation Analysis")
    print("-"*80)

    corr_matrix, high_corr_pairs = analyze_feature_correlation(X_train)

    # === FEATURE REDUNDANCY ===
    print("\n" + "-"*80)
    print("STEP 3: Redundancy Detection")
    print("-"*80)

    features_to_remove = identify_redundant_features(importance_df, high_corr_pairs, threshold=0.005)
    features_to_keep = [f for f in feature_names if f not in features_to_remove]

    # === FEATURE IMPORTANCE DISTRIBUTION ===
    print("\n" + "-"*80)
    print("STEP 4: Feature Importance Distribution")
    print("-"*80)

    cumsum = importance_df['importance'].cumsum() / importance_df['importance'].sum() * 100
    top_10_cum = cumsum.iloc[9] if len(cumsum) > 9 else cumsum.iloc[-1]
    top_20_cum = cumsum.iloc[19] if len(cumsum) > 19 else cumsum.iloc[-1]

    print(f"\nFeature Importance Cumulative Distribution:")
    print(f"  Top 5 features:  {cumsum.iloc[4]:.1f}% of total importance")
    print(f"  Top 10 features: {top_10_cum:.1f}% of total importance")
    print(f"  Top 20 features: {top_20_cum:.1f}% of total importance")

    # Find number of features needed for 80% importance
    features_for_80 = (cumsum >= 80).idxmax() + 1 if (cumsum >= 80).any() else len(cumsum)
    features_for_90 = (cumsum >= 90).idxmax() + 1 if (cumsum >= 90).any() else len(cumsum)
    print(f"  Needed for 80%:  {features_for_80} features")
    print(f"  Needed for 90%:  {features_for_90} features")

    # === OPTIMIZATION RECOMMENDATIONS ===
    print("\n" + "-"*80)
    print("STEP 5: Optimization Recommendations")
    print("-"*80)

    print(f"\nRecommendations for dataset optimization:")
    print(f"  • Remove {len(features_to_remove)} features: {(len(features_to_remove)/len(feature_names)*100):.1f}% reduction")
    print(f"  • Keep {len(features_to_keep)} features: {(len(features_to_keep)/len(feature_names)*100):.1f}% of original")
    print(f"  • Top {features_for_80} features capture ~80% of predictive power")
    print(f"  • Top {features_for_90} features capture ~90% of predictive power")

    # === CREATE OPTIMIZED VARIANTS ===
    print("\n" + "-"*80)
    print("STEP 6: Creating Optimized Datasets")
    print("-"*80)

    os.makedirs('data/processed', exist_ok=True)

    # Variant 1: Remove low importance & redundant
    indices_optimized = [i for i, f in enumerate(feature_names) if f in features_to_keep]
    X_train_opt = X_train.iloc[:, indices_optimized]
    X_test_opt = X_test.iloc[:, indices_optimized]

    X_train_opt.to_csv('data/processed/X_train_optimized.csv', index=False)
    X_test_opt.to_csv('data/processed/X_test_optimized.csv', index=False)
    y_train.to_csv('data/processed/y_train_optimized.csv', index=False) if hasattr(y_train, 'to_csv') else pd.Series(y_train).to_csv('data/processed/y_train_optimized.csv', index=False)
    y_test.to_csv('data/processed/y_test_optimized.csv', index=False) if hasattr(y_test, 'to_csv') else pd.Series(y_test).to_csv('data/processed/y_test_optimized.csv', index=False)

    with open('data/processed/feature_names_optimized.txt', 'w') as f:
        for feat in features_to_keep:
            f.write(feat + '\n')

    print(f"\n✓ Variant 1: Optimized (removed low importance & redundant)")
    print(f"  Features: {len(features_to_keep)} (was {len(feature_names)}, -{len(features_to_remove)})")
    print(f"  Size: {X_train_opt.shape}")

    # Variant 2: Top-80 importance
    features_top80 = importance_df.head(features_for_80)['feature'].tolist()
    indices_top80 = [i for i, f in enumerate(feature_names) if f in features_top80]

    X_train_top80 = X_train.iloc[:, indices_top80]
    X_test_top80 = X_test.iloc[:, indices_top80]

    X_train_top80.to_csv('data/processed/X_train_top80_importance.csv', index=False)
    X_test_top80.to_csv('data/processed/X_test_top80_importance.csv', index=False)

    with open('data/processed/feature_names_top80_importance.txt', 'w') as f:
        for feat in features_top80:
            f.write(feat + '\n')

    print(f"\n✓ Variant 2: Top-80 Importance ({features_for_80} features)")
    print(f"  Features: {len(features_top80)}")
    print(f"  Size: {X_train_top80.shape}")
    print(f"  Captures: ~80% of predictive power")

    # === SUMMARY REPORT ===
    print("\n" + "="*80)
    print("FEATURE SELECTION SUMMARY")
    print("="*80)

    summary = {
        'original_features': int(len(feature_names)),
        'features_removed': int(len(features_to_remove)),
        'features_kept': int(len(features_to_keep)),
        'reduction_percent': float((len(features_to_remove) / len(feature_names)) * 100),
        'top_10_features': importance_df.head(10)['feature'].tolist(),
        'features_for_80_percent': int(features_for_80),
        'features_for_90_percent': int(features_for_90),
        'removed_features': sorted(list(features_to_remove)),
        'top_n_importance': importance_df.head(len(feature_names))['feature'].tolist(),
    }

    with open('models/feature_selection_report.json', 'w') as f:
        json.dump(summary, f, indent=2)

    print(f"\n✓ Feature selection report saved to models/feature_selection_report.json")

    print(f"""
RESULTS SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Original features:                    {len(feature_names):3d}
  Features removed (low + redundant):   {len(features_to_remove):3d} ({(len(features_to_remove)/len(feature_names)*100):5.1f}%)
  Features kept (optimized set):        {len(features_to_keep):3d} ({(len(features_to_keep)/len(feature_names)*100):5.1f}%)
  Features for 80% importance:          {features_for_80:3d}
  Features for 90% importance:          {features_for_90:3d}

  Model complexity reduction:  {((len(feature_names)-len(features_to_keep))/len(feature_names)*100):.0f}%
  Space savings:               {X_train.shape[1]} → {len(features_to_keep)} dimensions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 TOP 10 MOST IMPORTANT FEATURES:
""")

    for i, (idx, row) in enumerate(importance_df.head(10).iterrows(), 1):
        print(f"  {i:2d}. {row['feature']:40s} ({row['importance_pct']:6.2f}%)")

    print(f"""
📁 GENERATED DATASETS:
  • X_train_optimized.csv         ({len(features_to_keep)} features)
  • X_train_top80_importance.csv  ({features_for_80} features)
  • feature_names_optimized.txt
  • feature_names_top80_importance.txt
  • feature_selection_report.json

✓ Ready to train models with optimized feature sets!
    """)

if __name__ == '__main__':
    feature_selection()
