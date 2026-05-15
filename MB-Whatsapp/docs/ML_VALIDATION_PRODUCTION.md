# MetaBrain ML Validation & Production Readiness

## Overview

MetaBrain implements a comprehensive ML validation system to prevent overfitting, detect model degradation, and ensure production reliability. This document describes the complete validation pipeline and how to use it.

## Validation Pipeline Architecture

```
Data → Features (18) → Train/Val/Test Split (70/15/15) → Model Training
                                                          ↓
                                    ┌─────────────────────┼─────────────────────┐
                                    ↓                     ↓                     ↓
                            Cross-Validation      Confusion Matrix      Overfitting Check
                            (Stratified K-Fold)      & Metrics             (Train/Test Gap)
                                    ↓                     ↓                     ↓
                                    └─────────────────────┼─────────────────────┘
                                                          ↓
                                                  Validation Report
                                                  (Readiness Score)
                                                          ↓
                                        Production Deployment Decision
```

## Components

### 1. Data Pipeline (`scripts/data_pipeline.py`)
**Purpose**: Transform raw incidents into ML-ready features with rich context
**Output**: Train/test CSV files with 37 engineered features (++270% vs baseline)

**Features Generated**:
- **Temporal Advanced (12)**: hour_of_day, day_of_week, day_of_month, month, time_since_last_min, incidents_last_1h/24h/7d, rolling_frequency, + normalized versions
- **Historical (10)**: last_action_taken, last_action_success, success_rate_last_10, failure_rate_last_10, success_rate_today, action_effectiveness_score, action_historical_success_rate, type_action_success_rate, retry_count_1h
- **Context (6)**: logs_count, metrics_count, has_data, severity (inferred), + normalized versions
- **Behavioral (4)**: retry_count_1h, escalation_flag, action_effectiveness_score, rolling_frequency
- **Categorical Encoded (9)**: incident_type, source, original_type, diagnosis_code, strategy, severity, action_type, source_category, last_action_taken

**Key Improvements**:
- ✓ Context-rich features capturing real behavior
- ✓ Historical signals enabling learning from past outcomes
- ✓ Normalized features [0,1] for ML compatibility
- ✓ Behavioral flags detecting escalation needs
- ✓ Feature encoders saved for inference

### 2. Model Training (`scripts/train_model.py`)
**Purpose**: Train RandomForestClassifier with comprehensive metrics
**Output**: Pickled model, ONNX export, metrics JSON

**Key Metrics Tracked**:
```json
{
  "timestamp": "ISO 8601",
  "num_features": 37,
  "train_accuracy": 0.0-1.0,
  "train_precision": 0.0-1.0,
  "train_recall": 0.0-1.0,
  "train_f1": 0.0-1.0,
  "test_accuracy": 0.0-1.0,
  "test_precision": 0.0-1.0,
  "test_recall": 0.0-1.0,
  "test_f1": 0.0-1.0,
  "cv_mean": 0.0-1.0,
  "cv_std": 0.0-1.0,
  "overfitting_score": 0.0-1.0,
  "num_train_samples": N,
  "num_test_samples": N
}
```

### 3. Model Validation (`scripts/validate_model.py`)
**Purpose**: Comprehensive validation report with overfitting detection and production readiness scoring

**Overfitting Detection**:
- **EXCELLENT**: Difference < 0.05 (5%)
- **GOOD**: Difference < 0.15 (15%)
- **WARNING**: Difference < 0.30 (30%)
- **CRITICAL**: Difference >= 0.30 (30%)

**Production Readiness Scoring** (0-100):
- Overfitting status: 0-40 points
- Test accuracy: 0-30 points (≥85%=30pts, ≥70%=20pts, ≥50%=10pts)
- CV stability: 0-20 points (low variance essential)
- Metric consistency: 0-10 points (precision/recall alignment)

**Deployment Recommendations**:
- **Score ≥80**: ✓ READY FOR PRODUCTION
- **Score 60-79**: ⚠ CAUTION - Monitor in production
- **Score 40-59**: ⚠ LIMITED - Use with restrictions
- **Score <40**: ✗ NOT READY - Needs improvement

### 4. Model Monitoring (`scripts/model_monitor.py`)
**Purpose**: Detect model degradation in production environment

**Degradation Checks**:
1. **Accuracy Degradation**: Alert if accuracy drops >10% from baseline
2. **Overfitting Increase**: Alert if overfitting score increases >0.15
3. **Data Distribution Shift**: Detect Jensen-Shannon divergence >0.3
4. **Training Data Quality**: Alert if <50 samples
5. **Model Staleness**: Alert if model >30 days old

**Alert Severity Levels**:
- **INFO**: Non-critical, informational
- **WARNING**: Needs attention, but not blocking
- **CRITICAL**: Requires immediate action

## Usage

### Run Complete Pipeline
```bash
# Execute all steps: data → train → validate → monitor
python scripts/run_ml_validation.py
```

### Run Individual Steps
```bash
# 1. Generate features
python scripts/data_pipeline.py

# 2. Train model with metrics
python scripts/train_model.py

# 3. Validate overfitting and readiness
python scripts/validate_model.py

# 4. Check model health in production
python scripts/model_monitor.py
```

## Validation Rules

### ✓ PASS Criteria
- [ ] No overfitting detected (difference < 0.15)
- [ ] Test accuracy ≥ 0.70
- [ ] Precision ≥ (Test Accuracy × 0.90)
- [ ] Recall ≥ (Test Accuracy × 0.90)
- [ ] F1-Score consistent with Accuracy (diff < 0.15)
- [ ] CV stable (std < mean × 0.20)
- [ ] ≥ 50 training samples

### ⚠ CAUTION Criteria
- [ ] Overfitting detected (0.15 < difference < 0.30)
- [ ] Test accuracy 0.50-0.70
- [ ] High CV variance (std ≥ mean × 0.20)
- [ ] 20-50 training samples

### ✗ FAIL Criteria
- [ ] Severe overfitting (difference ≥ 0.30)
- [ ] Test accuracy < 0.50
- [ ] Metric consistency issues
- [ ] < 20 training samples

## Overfitting Detection Strategy

**Rationale**: With minimal training data (1-10 samples), any model appears perfect. Overfitting is detected by comparing train vs test performance.

**Implementation**:
```python
overfitting_score = train_accuracy - test_accuracy
```

**Interpretation**:
- **0.0-0.05**: Excellent generalization - model learned patterns, not memorized
- **0.05-0.15**: Good generalization - minor optimization to training data
- **0.15-0.30**: Model overfitted - learned training set specifics
- **≥0.30**: Severe overfitting - model not reliable on unseen data

**With Few Samples**:
- Perfect training accuracy (100%) is expected with 1-2 samples
- Overfitting detection requires enough test samples to show divergence
- Recommend collecting 100+ samples before production deployment

## Cross-Validation Strategy

**Method**: Stratified K-Fold (k = min(5, len(X_train)))
- Maintains class distribution across folds
- Calculates all metrics (accuracy, precision, recall, F1) per fold
- Provides confidence interval for model generalization
- Validates model consistency across different data subsets

**Metrics Calculated per Fold**:
- Accuracy: Overall correctness
- Precision: Positive prediction accuracy
- Recall: Coverage of actual positives
- F1-Score: Balanced precision/recall metric

**Results**:
- Mean ± Standard Deviation for each metric
- Fold-by-fold breakdown for detailed analysis
- Consistency validation (std ≤ 0.10 for robust models)

**Interpretation**:
- **Mean ≥ 0.80, Std < 0.05**: Excellent, stable models
- **Mean ≥ 0.70, Std < 0.10**: Good, acceptable variance
- **Mean ≥ 0.60, Std < 0.15**: Borderline, monitor closely
- **Mean < 0.60 or Std > 0.15**: Poor generalization, needs improvement

**Consistency Validation**:
- **Std ≤ 0.05**: Very consistent (ideal for production)
- **Std ≤ 0.10**: Consistent (acceptable)
- **Std > 0.10**: High variance (unreliable, needs improvement)

## Confusion Matrix Analysis

**Tracked Metrics**:
- True Positives (TP): Correctly predicted positive cases
- False Positives (FP): Incorrectly predicted positive cases
- True Negatives (TN): Correctly predicted negative cases
- False Negatives (FN): Incorrectly predicted negative cases

**Derived Metrics**:
- **Precision**: TP / (TP + FP) - Accuracy of positive predictions
- **Recall**: TP / (TP + FN) - Coverage of actual positives
- **F1-Score**: 2 × (Precision × Recall) / (Precision + Recall) - Balanced metric

## Integration with Learning Service & Brain Decision System

The ML validation system integrates with:

### 1. Daily Retraining (learning.service.ts)
```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async retrainModel() {
  // 1. Gather new data from incidents + outcomes
  // 2. Run scripts/data_pipeline.py        → features from incidents
  // 3. Run scripts/train_model.py          → train & validate
  // 4. Model Registry auto-registers v1,v2,v3 with comparison
  // 5. Only deploys if validation passes (readiness ≥ 60)
  // 6. Alert if validation fails
}
```

### 2. Combined Scoring Decision (brain.service.ts)
**NEW**: ML is now the primary decision source with intelligent weighting:

```typescript
// Phase: ML Hybrid Decision with Combined Scoring
const insights = learningService.getInsights();  // Historical effectiveness

// Enrich ML features with learning signals
const mlFeatures: MlPredictionFeatures = {
  hourOfDay,       // 0-23
  dayOfWeek,       // 0-6
  isStrongAction,  // 1.0 if action has >80% historical success
  isWeakAction,    // 1.0 if action has >60% historical failure
  strategyConfidence,  // 0-1.0 from rules
  actionRiskScore      // 0-1.0 from diagnosis
};

// Get ML prediction (NOT hardcoded 1.0 anymore)
const mlResult = await modelService.predictDecision(mlFeatures);

// Combined Score Formula:
// score = (rules_confidence × 0.4) + (ml_confidence × 0.4) + (learning_boost × 0.2)
const combinedScore =
  (rulesConfidence × 0.4) +
  (mlConfidence × 0.4) +
  ((learningBoost + 0.10) × 0.2);

// Decision Gate: 0.70 threshold
if (combinedScore >= 0.70) {
  execAction(winnnerAction);  // Rules or ML, whichever scored highest
} else {
  escalate();  // Manual review recommended
}
```

**Deployment Gates**:
- Train/Validation/Test split enforced (70/15/15)
- Overfitting check: difference < 0.30
- Accuracy threshold: test_accuracy ≥ baseline
- Model validation passes (readiness score)
- **NEW**: Combined scoring gate: ≥0.70 threshold for execution
- **NEW**: Rules + ML + Learning Boost weighted ensemble
- **NEW**: ML accuracy tracking for post-execution analysis

## Monitoring in Production

Once deployed, the combined scoring system tracks:

1. **Combined Score Distribution**: Are rules + ML + learning aligning well?
2. **ML Accuracy**: How often does ML predict the winning action?
3. **Rules Accuracy**: How often do rules predict the winning action?
4. **Learning Boost Impact**: Do strong/weak actions improve combined score?
5. **Decision Breakdown**: What percentage comes from rules vs ML vs learning?
6. **Escalation Rate**: How many decisions score < 0.70 (need manual review)?
7. **Accuracy Degradation**: If combined score drops >10%, alert engineering team
8. **Data Drift**: If input distribution changes, retrain recommended
9. **Model Age**: If >30 days without retraining, schedule retrain
10. **System Health**: Overall status dashboard (HEALTHY/DEGRADED/CRITICAL)

**Example Health Report with Combined Scoring**:
```json
{
  "timestamp": "2026-04-13T00:00:00Z",
  "status": "HEALTHY",
  "alerts": [],
  "scoring_metrics": {
    "avg_combined_score": 0.78,
    "rules_avg_weight": 0.40,
    "ml_avg_weight": 0.40,
    "learning_avg_weight": 0.20,
    "ml_accuracy_rate": 0.82,
    "rules_accuracy_rate": 0.79,
    "escalation_rate": 0.12
  },
  "baseline_metrics": {
    "test_accuracy": 0.92,
    "overfitting_score": 0.03
  },
  "current_metrics": {
    "test_accuracy": 0.91,
    "overfitting_score": 0.04,
    "combined_score": 0.78
  }
}
```

**Key Metrics to Track**:
- Combined score mean/std (should be stable ~0.75-0.85)
- ML accuracy rate (% ML predictions match winners)
- Rules accuracy rate (% Rules predictions match winners)
- Learning boost distribution (-0.10 / 0.0 / +0.10)
- P95 prediction latency (ONNX + rules should be <10ms)
- Model accuracy vs ground truth (weekly reconciliation)
- Feature coverage (% of incidents with all 6 features)
- Escalation rate (% below 0.70 threshold)

## Data Requirements for Production

**Minimum Dataset Size**:
- 50 samples: ML model training begins
- 100 samples: Cross-validation detects issues
- 500 samples: Feature importance stabilizes
- 1000+ samples: High-confidence production deployment

**Class Balance**:
- Minimum 10 samples per class
- Avoid >90:10 severe imbalance
- Use stratified split to maintain distribution

**Feature Stability**:
- 18 features must be consistently extactable from incidents
- Missing values handled via pandas fillna()
- Categorical encoders saved and reused (`feature_encoders.pkl`)

## Continuous Improvement

**Feedback Loop**:
1. Deploy model to production
2. Monitor performance with health checks
3. Collect execution outcomes
4. Periodically retrain with new data (daily at midnight)
5. Compare new model metrics to current baseline
6. Deploy only if validation passes

**Key Metrics to Track**:
- P95 prediction latency (ONNX inference should be <5ms)
- Model accuracy vs ground truth (weekly reconciliation)
- Feature coverage (% of incidents with all 18 features)
- Prediction confidence distribution (is model confident?)

## Troubleshooting

### Issue: CV Variance High
**Cause**: Too few samples or class imbalance
**Solution**:
- Collect more diverse training data
- Use stratified sampling if possible
- Consider data augmentation

### Issue: Overfitting Detected
**Cause**: Model learned training data too specifically
**Solution**:
- Reduce model complexity (fewer trees in RandomForest)
- Add regularization (min_samples_leaf, max_depth)
- Increase training data
- Feature engineering improvements

### Issue: Low Test Accuracy
**Cause**: Features insufficient or model too simple
**Solution**:
- Analyze feature importance
- Engineer new features
- Increase model complexity if possible
- Verify data quality

### Issue: Accuracy Degraded in Production
**Cause**: Data distribution shift or concept drift
**Solution**:
- Run model_monitor.py to diagnose
- Check data distribution changes
- Retrain with recent data
- Consider online learning approach

## Performance Targets

| Metric | Target | Threshold |
|--------|--------|-----------|
| Test Accuracy | ≥0.85 | ≥0.70 |
| Test Precision | ≥0.85 | ≥0.70 |
| Test Recall | ≥0.85 | ≥0.70 |
| Test F1-Score | ≥0.85 | ≥0.70 |
| Overfitting Score | <0.05 | <0.30 |
| CV Stability (std) | < 0.05 | < 0.10 |
| Model Consistency | ✓ (std ≤ 0.05) | ✓ (std ≤ 0.10) |
| Production Readiness | ≥85 | ≥60 |
| **Combined Score** | **≥0.75** | **≥0.70** |
| **ML Accuracy Rate** | **≥0.80** | **≥0.65** |
| **Rules Accuracy Rate** | **≥0.75** | **≥0.60** |
| **Escalation Rate** | **<0.10** | **<0.25** |
| ONNX Inference Time | <5ms | <50ms |
| Model Age | <7 days | <30 days |
| Accuracy Degradation | <2% | <10% |

### New Metrics Explanation

**Combined Score**: Weighted ensemble of rules (40%) + ML (40%) + learning boost (20%)
- ≥0.75: Excellent confidence, immediate execution
- 0.70-0.74: Good confidence, execute with monitoring
- <0.70: Low confidence, escalate for manual review

**ML Accuracy Rate**: Percentage of time ML prediction matches the winning action
- ≥0.80: ML is providing strong signal
- 0.65-0.79: ML is competitive with rules
- <0.65: ML may need retraining or feature engineering

**Rules Accuracy Rate**: Percentage of time rules prediction (via strategy) matches winning action
- ≥0.75: Rules are reliable baselines
- 0.60-0.74: Rules and ML are comparable
- <0.60: Rules may need refinement

**Escalation Rate**: Percentage of decisions below 0.70 combined score threshold
- <0.10: System is confident, healthy
- 0.10-0.25: Some escalations, monitor trends
- >0.25: Too many uncertain decisions, may need tuning

## Files Generated

```
models/
├── decision_model.pkl          # Scikit-learn model binary
├── decision_model.onnx         # ONNX export for Node.js
├── model_metrics.json          # Comprehensive metrics
├── confusion_matrix.json       # Confusion matrix + stats
└── monitoring/
    └── latest_health_check.json # Production health snapshot

data/processed/
├── X_train.csv                 # Training features
├── X_test.csv                  # Test features
├── y_train.csv                 # Training labels
├── y_test.csv                  # Test labels
├── feature_names.txt           # Feature list
├── feature_encoders.pkl        # Categorical encoders
└── action_encoder.pkl          # Action label encoder
```

## References

- **Overfitting**: https://en.wikipedia.org/wiki/Overfitting
- **Stratified K-Fold**: https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.StratifiedKFold.html
- **Confusion Matrix**: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.confusion_matrix.html
- **RandomForest**: https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html

## Support

For validation issues or questions, check:
1. `scripts/validate_model.py` output for detailed recommendations
2. `models/model_metrics.json` for historical metrics comparison
3. `models/monitoring/latest_health_check.json` for production status
