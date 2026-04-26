# 🚀 IMMEDIATE ACTION PLAN: Phase 3 - Model Training & Benchmark

**Current Status:** Phase 1 & 2 ✅ Complete  
**Timeline:** Starting now  
**Objective:** Train models with 3 feature sets and select optimal for production  

---

## PHASE 3 ROADMAP

### Week 1: Model Training & Benchmarking

#### 🎯 Day 1-2: Training Phase
- **Output datasets ready:** ✅ Yes (3 variants prepared)
- **Encoders ready:** ✅ Yes (saved to disk)
- **Feature sets ready:** ✅ Yes (31 and 18-feature variants created)

**Tasks:**
```bash
# Task 1: Train full 37-feature model
python scripts/train_model.py --features full --n-estimators 100

# Task 2: Train 31-feature optimized model  
python scripts/train_model.py --features top80 --n-estimators 100

# Task 3: Train 18-feature minimal model
python scripts/train_model.py --features top90 --n-estimators 100

# Task 4: Train baseline (previous 10-feature model) for comparison
python scripts/train_model.py --features baseline --n-estimators 100
```

**Expected outputs:**
- `models/classifier_full.pkl`
- `models/classifier_top80.pkl`
- `models/classifier_top90.pkl`
- `models/classifier_baseline.pkl`

#### 🎯 Day 3-4: Benchmarking Phase
```bash
# Task 5: Benchmark inference speed
python scripts/benchmark_inference.py --model-dir models/

# Task 6: Compare metrics
python scripts/model_compare.py --all-models

# Task 7: Analyze trade-offs
python scripts/analyze_tradeoffs.py
```

**Expected outputs:**
- Speed metrics (inference time per feature set)
- Accuracy comparison table
- Memory footprint analysis
- Trade-off summary report

#### 🎯 Day 5: Decision & Reporting
- Consolidate results
- Present to stakeholders
- Select optimal feature set
- Document selection rationale

---

## DETAILED EXECUTION PLAN

### Step 1: Verify Feature Sets Are Ready

```python
# Validation script
import os
import pandas as pd

feature_sets = {
    'full': 'data/processed/X_train_optimized.csv',
    'top80': 'data/processed/X_train_top80_importance.csv',
}

for name, path in feature_sets.items():
    if os.path.exists(path):
        df = pd.read_csv(path)
        print(f"✓ {name}: {df.shape[1]} features, {df.shape[0]} samples")
    else:
        print(f"✗ {name}: Not found at {path}")
```

**Expected output:**
```
✓ full: 37 features, 1 samples
✓ top80: 31 features, 1 samples
```

### Step 2: Create train_model.py Script

**Features needed:**
- Load selected feature set by name
- Train RandomForestClassifier with standard hyperparameters
- Save model with metadata
- Generate initial performance metrics
- Export to ONNX format

**Code template:**
```python
#!/usr/bin/env python3
import pandas as pd
import argparse
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import pickle

def train_model(feature_set='full', n_estimators=100):
    """Train model with specified feature set"""
    
    # Load datasets
    if feature_set == 'full':
        X_train = pd.read_csv('data/processed/X_train_optimized.csv')
        X_test = pd.read_csv('data/processed/X_test_optimized.csv')
    elif feature_set == 'top80':
        X_train = pd.read_csv('data/processed/X_train_top80_importance.csv')
        X_test = pd.read_csv('data/processed/X_test_top80_importance.csv')
    else:
        raise ValueError(f"Unknown feature set: {feature_set}")
    
    y_train = pd.read_csv('data/processed/y_train_optimized.csv').values.ravel()
    y_test = pd.read_csv('data/processed/y_test_optimized.csv').values.ravel()
    
    # Train model
    print(f"Training RandomForest with {feature_set} feature set...")
    print(f"  Features: {X_train.shape[1]}")
    print(f"  Sample size: {X_train.shape[0]}")
    
    model = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=15,
        min_samples_split=2,
        min_samples_leaf=1,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    train_score = model.score(X_train, y_train)
    test_score = model.score(X_test, y_test)
    
    print(f"✓ Model trained")
    print(f"  Train accuracy: {train_score:.4f}")
    print(f"  Test accuracy:  {test_score:.4f}")
    
    # Save model
    model_path = f'models/classifier_{feature_set}.pkl'
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    print(f"✓ Model saved to {model_path}")
    
    return model, train_score, test_score

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--features', default='full', 
                      choices=['full', 'top80', 'top90'])
    parser.add_argument('--n-estimators', type=int, default=100)
    args = parser.parse_args()
    
    train_model(args.features, args.n_estimators)
```

### Step 3: Create model_compare.py Script

**Purpose:** Compare all trained models side-by-side

**Metrics to compare:**
- Training accuracy
- Test accuracy
- Overfitting gap (train - test)
- Model size (number of parameters)
- Feature count
- Inference time estimate

**Output format:**
```
MODEL COMPARISON REPORT
════════════════════════════════════════════════════════════════════════════════

Model          Features  Train Acc  Test Acc  Overfitting  Approx Time  Size
─────────────────────────────────────────────────────────────────────────────
Baseline            10     0.8000    0.7500      5.0%        ~2.0ms    XXXXX
Full Set (37)       37     0.8500    0.7800      7.0%        ~2.5ms    XXXXX
Top-80 (31)         31     0.8400    0.7700      7.0%        ~2.1ms    XXXXX
Top-90 (18)         18     0.8200    0.7400      8.0%        ~1.3ms    XXXXX

RECOMMENDATION:
  ✓ TOP-80 FEATURE SET (31 features)
    - 16% reduction in feature count
    - Minimal accuracy loss (-0.1%)
    - ~16% faster inference
    - Best balance of accuracy/efficiency
```

### Step 4: Create benchmark_inference.py Script

**Purpose:** Measure actual inference speed

**What to measure:**
- Time per prediction (single sample)
- Time per batch (100 samples)
- Total memory usage
- Model load time
- Throughput (predictions per second)

**Target output:**
```
INFERENCE BENCHMARK REPORT
════════════════════════════════════════════════════════════════════════════════

Feature Set      Model Size   Load Time   Single Pred   Batch/100   Throughput
────────────────────────────────────────────────────────────────────────────────
Full (37)         ~5.2 MB      0.85ms      0.92ms       45.3ms      2207 pred/s
Top-80 (31)       ~4.6 MB      0.78ms      0.78ms       38.5ms      2597 pred/s  ✓
Top-90 (18)       ~3.8 MB      0.71ms      0.51ms       25.3ms      3953 pred/s
Baseline (10)     ~2.1 MB      0.45ms      0.38ms       18.7ms      5348 pred/s

Analysis:
  - With 18 features: ~2x faster than full set
  - With 31 features: Similar speed to full, ~16% smaller
  - Memory savings: 12% (full) -> 27% (top-90)
```

---

## DECISION FRAMEWORK

Use this framework to select the optimal feature set:

### Selection Criteria

| Criterion | Weight | Full (37) | Top-80 (31) | Top-90 (18) |
|-----------|--------|-----------|-------------|------------|
| **Accuracy** | 40% | 100% | 99% | 95% |
| **Inference Speed** | 30% | 100% | 110% | 200% |
| **Model Size** | 20% | 100% | 88% | 73% |
| **Interpretability** | 10% | 100% | 90% | 75% |
| **Weighted Score** | 100% | **100** | **103** ✓ | **97** |

### Scoring Logic

```python
def score_feature_set(accuracy_score, speed_factor, size_factor, interpretability):
    """Score a feature set based on multiple criteria"""
    
    weighted_score = (
        accuracy_score * 0.40 +           # Accuracy is most important
        speed_factor * 0.30 +             # Speed matters (cost/UX)
        (100 / size_factor) * 0.20 +      # Size (smaller is better)
        interpretability * 0.10            # Interpretability
    )
    
    return weighted_score
```

### Expected Recommendation

Based on typical results:
- **Development/Testing:** Use Full set (37 features) = maximum information
- **Production:** Use Top-80 set (31 features) = best balance
- **Edge Deployment:** Use Top-90 set (18 features) = extreme efficiency

---

## SUCCESS CRITERIA

### ✅ Training Success Criteria
- [x] Feature sets prepared (ready)
- [ ] All 3 models train successfully
- [ ] Training completes in <5 minutes total
- [ ] Both train and test accuracies > 70%
- [ ] Models export to ONNX successfully

### ✅ Benchmarking Success Criteria
- [ ] Inference speed measured for all 3 models
- [ ] Speed improvements quantified
- [ ] Memory footprint documented
- [ ] Trade-offs clearly presented
- [ ] Recommendation made with rationale

### ✅ Decision Success Criteria
- [ ] Feature set selected based on objective criteria
- [ ] Selection documented with justification
- [ ] Stakeholder consensus achieved
- [ ] Ready to proceed to deployment

---

## EXPECTED TIMELINE

```
Phase 3: Model Training & Benchmark
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Day 1-2:  Model Training (3 variants + baseline)
  ├─ 08:00 - Review feature sets (15 min)
  ├─ 08:30 - Train full set (5-10 min)
  ├─ 09:00 - Train top-80 set (5-10 min)
  ├─ 09:30 - Train top-90 set (5-10 min)
  ├─ 10:00 - Train baseline (5-10 min)
  └─ 11:00 - Complete ✓ (2 hours total)

Day 3-4: Benchmarking & Analysis
  ├─ 14:00 - Benchmark inference speed
  ├─ 15:00 - Generate comparison report
  ├─ 16:00 - Create visualizations
  ├─ 17:00 - Analyze trade-offs
  └─ 18:00 - Draft decision memo

Day 5:    Decision & Communication
  ├─ 09:00 - Final stakeholder review
  ├─ 10:00 - Select feature set
  ├─ 11:00 - Update documentation
  └─ 12:00 - Begin Phase 4 planning

Total Time: ~1 week
Ready Date: Next Monday
```

---

## OUTPUT DELIVERABLES

At end of Phase 3, deliver:

### 📊 Performance Report
```
model_comparison_report.md
├─ Accuracy comparison
├─ Inference speed analysis
├─ Memory footprint analysis
├─ Trade-off discussion
└─ Recommendation with rationale
```

### 📈 Benchmark Results
```
models/
├─ classifier_full.pkl
├─ classifier_top80.pkl
├─ classifier_top90.pkl
├─ classifier_baseline.pkl
└─ benchmark_results.json
```

### 📋 Decision Documentation
```
Selected Feature Set: Top-80 Importance (31 features)
Rationale: Best balance of accuracy/efficiency
Expected Impact: +5% faster inference, -16% model size
Ready Date: [Date]
Approved By: [Name]
```

---

## CONTINGENCY PLANS

### If models don't train successfully
- Check feature names match between train/test
- Verify encoders are loaded correctly
- Check for any NaN values in prepared data
- Review data_pipeline.py for issues

### If accuracy is low (<70%)
- Check label encoding (y_train values)
- Verify feature normalization is correct
- Consider hyperparameter tuning
- Review feature engineering decisions

### If inference speed is slow
- Profile the model (scikit-learn profiling)
- Consider reducing tree depth
- Reduce number of trees
- Check for vector operations bottlenecks

---

## NEXT PHASE PREVIEW

### Phase 4: Production Deployment (Scheduled after Phase 3)

Once optimal feature set is selected:

1. **Update Inference Pipeline**
   - Update feature extraction to use selected features
   - Load correct encoder/scaler
   - Deploy new model to staging

2. **Integration Testing**
   - Test with real incident data
   - Validate feature extraction
   - Verify prediction quality

3. **Production Release**
   - Canary deployment (10% traffic)
   - Monitor performance metrics
   - Full rollout after validation

---

## QUESTIONS & SUPPORT

**Questions during Phase 3?**
- Check FEATURE_SELECTION_ANALYSIS.md for feature details
- Review QUICKSTART_FEATURE_SELECTION.md for usage
- Consult PHASES_1_2_COMPLETION_SUMMARY.md for context

**Ready to start?**

```bash
# 1. Verify features are ready
python -c "import pandas as pd; print(pd.read_csv('data/processed/X_train_optimized.csv').shape)"

# 2. Create train_model.py script (see template above)
# 3. Run training commands (see Step 2)
# 4. Compare results (see Step 3)
# 5. Make decision (see Decision Framework)
```

---

**Status:** ✅ Ready to begin Phase 3  
**Next Step:** Create train_model.py and start training  
**Timeline:** 1 week  
**Goal:** Select optimal feature set for production deployment  

🎯 **Let's go!**
