# MetaBrain Model Registry & Version Control

## Overview

MetaBrain implements a comprehensive model registry system to track model evolution, manage versions, enable safe comparisons, and support automatic rollback when issues arise.

## Architecture

```
Training Pipeline
       ↓
train_model.py (with integrated registry)
       ↓
Model Registration
       ├─ Version: v1, v2, v3, etc
       ├─ Store: models/v1/, models/v2/, etc
       └─ Metadata: metrics, timestamp, notes
       ↓
Model Comparison
       ├─ vs Production
       ├─ Automated recommendation
       └─ Decision gates
       ↓
Deployment Decision
       ├─ DEPLOY (auto-promote)
       ├─ DEPLOY_WITH_CAUTION (manual review)
       ├─ REVIEW (conditional)
       └─ REJECT (block deployment)
       ↓
Production/Staging
       ├─ v1 (superseded)
       ├─ v2 (production)
       └─ v3 (staging)
       ↓
Monitoring
       ├─ Health checks
       ├─ Degradation detection
       └─ Automatic rollback triggers
```

## Components

### 1. Model Registry (`scripts/model_registry.py`)

**Purpose**: Central registry for all model versions

**Key Functions**:
```python
registry = ModelRegistry('models/registry.json')

# Register new model after training
version = registry.register_model(
    metrics={'test_accuracy': 0.92, ...},
    notes="Training with 500 samples"
)
# Returns: 'v2'

# Promote staging to production
registry.promote_to_production('v2')

# Get current versions
prod = registry.get_production_version()
staging = registry.get_staging_version()

# Load model from registry
model = registry.load_model('v2', format='pkl')

# Print history
registry.print_history()
```

**Registry Structure** (`models/registry.json`):
```json
{
  "versions": [
    {
      "version": "v1",
      "timestamp": "2026-04-10T10:00:00Z",
      "train_accuracy": 0.90,
      "test_accuracy": 0.88,
      "train_f1": 0.89,
      "test_f1": 0.87,
      "overfitting_score": 0.02,
      "cv_mean": 0.87,
      "cv_std": 0.03,
      "num_train_samples": 400,
      "num_test_samples": 100,
      "num_features": 18,
      "status": "SUPERSEDED",
      "notes": "Initial training"
    },
    {
      "version": "v2",
      "timestamp": "2026-04-11T10:00:00Z",
      "train_accuracy": 0.95,
      "test_accuracy": 0.92,
      "overfitting_score": 0.03,
      "status": "PRODUCTION",
      "notes": "Improved with more data"
    },
    {
      "version": "v3",
      "timestamp": "2026-04-12T10:00:00Z",
      "train_accuracy": 0.96,
      "test_accuracy": 0.93,
      "overfitting_score": 0.03,
      "status": "STAGING",
      "notes": "Feature engineering improvements"
    }
  ],
  "current_production": "v2",
  "staging": "v3",
  "history": [
    {
      "event": "registered",
      "version": "v1",
      "timestamp": "2026-04-10T10:00:00Z",
      "notes": "Initial training"
    },
    {
      "event": "promoted_to_production",
      "version": "v2",
      "timestamp": "2026-04-11T10:30:00Z",
      "previous_production": "v1"
    }
  ]
}
```

**Version Directory Structure**:
```
models/
├── v1/
│   ├── decision_model.pkl
│   ├── decision_model.onnx
│   ├── confusion_matrix.json
│   └── metrics.json
├── v2/
│   ├── decision_model.pkl
│   ├── decision_model.onnx
│   ├── confusion_matrix.json
│   └── metrics.json
├── v3/
│   ├── decision_model.pkl
│   ├── decision_model.onnx
│   ├── confusion_matrix.json
│   └── metrics.json
├── registry.json          # Central registry
└── current -> v2/         # Symlink to production
```

### 2. Model Comparison (`scripts/model_compare.py`)

**Purpose**: Automatically compare versions and recommend deployment

**Key Functions**:
```python
comparator = ModelComparison('models/registry.json')

# Compare two versions
comparison = comparator.compare_versions('v1', 'v2')
# Returns detailed metric comparison

# Compare against production
comparison = comparator.compare_with_production('v3')

# Get deployment recommendation
recommendation = comparator.recommend_deployment('v3')
# Returns: {
#   'version': 'v3',
#   'recommendation': 'DEPLOY',
#   'confidence': 0.85,
#   'checks': {
#     'accuracy': {'pass': True, 'improvement': 0.02},
#     'overfitting': {'pass': True, 'improvement': 0.01},
#     'stability': {'pass': True},
#     'data': {'pass': True}
#   }
# }
```

**Recommendation Logic**:

For each candidate version, evaluate:

1. **Accuracy Check** (30% weight)
   - ✓ PASS: ≥2% improvement from production
   - ⚠ PASS: Within 5% degradation tolerance
   - ✗ FAIL: >5% accuracy loss

2. **Overfitting Check** (25% weight)
   - ✓ PASS: Less overfitting than production
   - ⚠ PASS: Up to +0.10 more overfitting acceptable
   - ✗ FAIL: Significantly worse overfitting

3. **Stability Check** (15% weight)
   - ✓ PASS: Better or equal CV stability
   - ⚠ PASS: Up to 20% worse acceptable
   - ✗ FAIL: Much worse cross-validation stability

4. **Data Quality Check** (15% weight)
   - ✓ PASS: ≥ production training samples
   - ✗ FAIL: Fewer training samples

5. **Confidence Score** (0-1.0 scale)
   - Total = passing check weights
   - Final recommendation based on cumulative confidence

**Decision Matrix**:
```
Checks Passed  Confidence   Recommendation
─────────────────────────────────────────────
4/4            ≥0.70        DEPLOY
≥3/4           ≥0.50        DEPLOY_WITH_CAUTION
≥2/4           <0.50        REVIEW
<2/4           <0.50        REJECT
```

**Output**: `models/reports/recommendation_v3.json`

### 3. Model Rollback (`scripts/model_rollback.py`)

**Purpose**: Safely rollback to previous versions

**Key Functions**:
```python
rollback_mgr = ModelRollback('models/registry.json')

# Get available rollback candidates
candidates = rollback_mgr.get_rollback_candidates()
# Returns list of SUPERSEDED and PRODUCTION versions (excluding current)

# Initiaterollback
success = rollback_mgr.rollback_to_version(
    'v2',
    reason='v3 degraded in production'
)

# Automatic rollback if degradation detected
triggered = rollback_mgr.automatic_rollback(
    degradation_threshold=0.10  # Alert if >10% accuracy loss
)

# Print deployment history
rollback_mgr.print_deployment_history()

# Print candidates
rollback_mgr.print_rollback_candidates()
```

**Rollback Process**:
1. Verify target version exists
2. Copy model files from version directory to current
3. Update registry status
4. Record event in history
5. Report success/failure

---

## Usage Workflow

### Automatic (Default)

```bash
# 1. Train model - automatically registers and compares
python scripts/train_model.py

# Output:
# ✓ Model v3 registered
#   Location: models/v3/
#   Test Accuracy: 0.9300
#   Overfitting: 0.0300
#
# DEPLOYMENT RECOMMENDATION: v3
# Recommendation: DEPLOY
# Confidence: 85%
#
# Check                Status        Details
# ─────────────────────────────────────────
# accuracy             ✓ PASS        0.9200 → 0.9300 (+0.0100)
# overfitting          ✓ PASS        0.0300 → 0.0300 (0.0000)
# stability            ✓ PASS        Better cross-validation
# data                 ✓ PASS        More training samples
```

### Manual Promotion

```bash
# 1. List all versions
python scripts/model_registry.py
# Shows: v1 (SUPERSEDED), v2 (PRODUCTION), v3 (STAGING)

# 2. Review recommendation
cat models/reports/recommendation_v3.json

# 3. Manually promote if needed
python -c "
from model_registry import ModelRegistry
registry = ModelRegistry()
registry.promote_to_production('v3')
"
```

### Rollback

```bash
# 1. See rollback candidates
python -c "
from model_rollback import ModelRollback
mgr = ModelRollback()
mgr.print_rollback_candidates()
"

# 2. Perform rollback
python scripts/model_rollback.py v2 'Reverting to previous stable version'
```

## Version Lifecycle

```
┌──────────┐
│ Training │
└────┬─────┘
     │
     ├─→ Model registered as vN (STAGING)
     │   - Files saved to models/vN/
     │   - Metrics recorded
     │
     ├─→ Automatic comparison with vN-1 (PRODUCTION)
     │   - Accuracy: ✓/⚠/✗
     │   - Overfitting: ✓/⚠/✗
     │   - Stability: ✓/⚠/✗
     │   - Data: ✓/⚠/✗
     │
     ├─→ Recommendation generated
     │   - DEPLOY: Auto-promote immediately
     │   - DEPLOY_WITH_CAUTION: Manual review required
     │   - REVIEW: Conditional, needs analysis
     │   - REJECT: Block deployment
     │
     └─→ vN-1 status changes
         PRODUCTION → SUPERSEDED
         vN status: STAGING → PRODUCTION


┌──────────────────────────┐
│ Production Monitoring    │
└────┬─────────────────────┘
     │
     ├─→ Health checks on vN
     │   - Accuracy degradation >10%?
     │   - Overfitting increase >0.15?
     │   - Data drift detected?
     │   - Model age >30 days?
     │
     ├─→ If issues detected
     │   - Generate alert
     │   - Trigger automatic rollback?
     │   - Or wait for manual decision
     │
     └─→ vN degraded → SUPERSEDED
         vN-1 restored → PRODUCTION


        ┌─────────────┐
        │  Rollback   │
        └──────┬──────┘
               │
               ├─→ Select vN-1 (SUPERSEDED)
               │   - Copy files to models/
               │   - Update registry
               │   - Record rollback event
               │
               └─→ vN-1 status: SUPERSEDED → PRODUCTION
                   vN status: PRODUCTION → SUPERSEDED
```

## Status Meanings

**STAGING**: Newly registered, pending validation
- Not deployed to production
- Undergoing comparison analysis
- Awaiting promotion decision

**PRODUCTION**: Currently serving in production
- Active model answering requests
- Monitored for degradation
- Baseline for comparison

**SUPERSEDED**: Previous version replaced
- Could be restored via rollback
- Kept for history/audit
- Model available in version directory

**REJECTED**: Failed validation
- Will not be promoted
- Kept for reference
- Can be analyzed for failure reasons

---

## Integration with Training Pipeline

**train_model.py** now automatically:

1. Trains model
2. Calculates metrics
3. **Registers with model_registry.py**
   ```python
   registry = ModelRegistry()
   version = registry.register_model(metrics, notes="...")
   ```

4. **Calls model_compare.py**
   ```python
   comparator = ModelComparison()
   recommendation = comparator.recommend_deployment(version)
   ```

5. **Saves recommendation**
   ```
   models/reports/recommendation_v3.json
   ```

6. **Prints summary**
   ```
   ✓ Model v3 registered
   ✓ Recommendation: DEPLOY (85% confidence)
   ✓ History updated
   ```

---

## Metrics Tracked Per Version

Each version stores:

| Metric | Purpose |
|--------|---------|
| `version` | Version ID (v1, v2, v3) |
| `timestamp` | When model was created |
| `train_accuracy` | Accuracy on training set |
| `test_accuracy` | Accuracy on test set |
| `train_f1` | F1-score on training set |
| `test_f1` | F1-score on test set |
| `overfitting_score` | Train - Test accuracy gap |
| `cv_mean` | Cross-validation mean |
| `cv_std` | Cross-validation std dev |
| `num_train_samples` | Training data size |
| `num_test_samples` | Test data size |
| `num_features` | Feature count (always 18) |
| `status` | STAGING / PRODUCTION / SUPERSEDED / REJECTED |
| `notes` | Custom notes (why trained, what changed, etc) |

---

## Deployment Gates

Model must pass gates to be promoted:

1. **Validation Gates**
   - ✓ No severe overfitting (score < 0.30)
   - ✓ Good accuracy (≥0.70)
   - ✓ Metric consistency (precision/recall aligned)
   - ✓ Sufficient data (≥50 samples)

2. **Comparison Gates**
   - ✓ Not worse than production (within 5% tolerance)
   - ✓ No dramatic metric changes
   - ✓ Improved or stable generalization

3. **Health Gates**
   - ✓ Model loads without errors
   - ✓ ONNX export successful
   - ✓ Inference latency acceptable

4. **Human Gates** (optional)
   - ✓ Manual review approval
   - ✓ Business stakeholder sign-off

---

## Commands Reference

```bash
# 1. TRAINING & REGISTRATION
python scripts/train_model.py
# Trains, validates, registers, compares, recommends

# 2. REGISTRY MANAGEMENT
python -c "from model_registry import ModelRegistry; \
  r = ModelRegistry(); r.print_history(); r.print_summary()"

# 3. COMPARISON
python scripts/model_compare.py
# Compares last two versions and recommends

# 4. PROMOTION (manual)
python -c "from model_registry import ModelRegistry; \
  r = ModelRegistry(); r.promote_to_production('v3')"

# 5. ROLLBACK
python scripts/model_rollback.py v2 'Issue detected'
# Restores v2 to production

# 6. VIEW CANDIDATES
python -c "from model_rollback import ModelRollback; \
  m = ModelRollback(); m.print_rollback_candidates()"

# 7. VIEW HISTORY
python -c "from model_rollback import ModelRollback; \
  m = ModelRollback(); m.print_deployment_history()"
```

---

## Example Flow

```text
Day 1 - Initial Training
$ python scripts/train_model.py
✓ Model v1 registered
✓ Recommendation: DEPLOY (80% confidence - first version)
✓ Promoted to PRODUCTION

Day 2 - Improvement
$ python scripts/train_model.py
✓ Model v2 registered
✓ Compares v2 vs v1 (PRODUCTION)
  ├─ Accuracy: +0.03 improvement ✓
  ├─ Overfitting: Same ✓
  ├─ Stability: Better ✓
  └─ Data: More samples ✓
✓ Recommendation: DEPLOY (85% confidence)
✓ v1 demoted to SUPERSEDED
✓ v2 promoted to PRODUCTION

Day 3 - Regression
$ python scripts/train_model.py
✓ Model v3 registered
✓ Compares v3 vs v2 (PRODUCTION)
  ├─ Accuracy: -0.08 degradation ✗
  ├─ Overfitting: Worse ✗
  ├─ Stability: Worse ✗
  └─ Data: Same ⚠
✓ Recommendation: REJECT (25% confidence)
✓ v3 marked as REJECTED, not promoted

Day 4 - Production Issue
$ python scripts/model_monitor.py
⚠ ALERT: v2 accuracy dropped to 0.84 (was 0.92)

$ python scripts/model_rollback.py v1 'Accuracy degraded >10%'
✓ Rollback successful
✓ v1 promoted to PRODUCTION
✓ v2 demoted to SUPERSEDED
✓ Rollback event recorded in history
```

---

## Files Generated

```
models/
├── registry.json                 # Central registry
├── v1/
│   ├── decision_model.pkl
│   ├── decision_model.onnx
│   ├── confusion_matrix.json
│   └── metrics.json
├── v2/
│   ├── decision_model.pkl
│   ├── decision_model.onnx
│   ├── confusion_matrix.json
│   └── metrics.json
├── v3/
│   ├── decision_model.pkl
│   ├── decision_model.onnx
│   ├── confusion_matrix.json
│   └── metrics.json
└── reports/
    ├── recommendation_v1.json
    ├── recommendation_v2.json
    └── recommendation_v3.json
```

---

## Support & Troubleshooting

**Issue**: version not found in registry
- Check `models/registry.json` exists
- Verify version ID format (v1, v2, etc)
- Run training to create first version

**Issue**: old model files still loading
- Ensure symlink `models/current -> models/vN/` redirects
- Clear any Python import caches
- Restart application

**Issue**: rollback fails
- Verify target version directory exists
- Check file permissions
- Ensure sufficient disk space

**Issue**: recommendation always REJECT
- Check CV stability (std too high with few samples)
- Collect more training data
- Review feature engineering

---

**Version**: 1.0
**Status**: Production Ready
**Last Updated**: 2026-04-12
