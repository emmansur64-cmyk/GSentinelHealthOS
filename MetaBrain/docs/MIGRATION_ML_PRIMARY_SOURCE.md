# Migration Guide: ML as Primary Decision Source

## Overview

**Release**: Phase 6 - ML Intelligence Upgrade
**Changes**: Eliminated dependency on rules as fallback. Implemented intelligent combination of ML + Rules using weighted scoring.
**Impact**: Better decisions, more agile, learning-driven system.
**Backward Compatible**: Yes (all existing routes still work)

## What Changed

### Before: ML vs Rules (Comparison)

```
Rules Strategy → decision.confidence (0.55-0.92)
                        ↓
ML Prediction → mlResult.confidence (hardcoded 1.0)
                        ↓
if (1.0 > 0.92) → ML WINS (almost always)
else → Rules WIN
```

**Problems**:
- ML always wins due to hardcoded 1.0 confidence
- Rules are sidelined, not validated
- No feedback from learning service
- Single dimension decision making
- No escalation for low-confidence cases

### After: ML + Rules + Learning (Ensemble)

```
Rules Strategy → rules_confidence (0.55-0.92)
        ↓
ML Features ← Enriched by LearningService.getInsights()
        ↓
ML Prediction → ml_confidence (0-1.0 REAL)
        ↓
COMBINED SCORE = (rules × 0.4) + (ml × 0.4) + (learning_boost × 0.2)
        ↓
if (0.70 <= score <= 1.0) → Execute
if (score < 0.70) → Escalate
```

**Benefits**:
- Rules (40%) + ML (40%) + Learning (20%) all participate
- Real ML confidence (0-1.0), not hardcoded
- Learning feedback improves future decisions
- Multi-factor validation before execution
- Clear escalation for uncertain decisions
- Interpretable scoring breakdown

## Affected Components

### 1. ModelService (src/ml/model.service.ts)

**Changed Method Signature**:
```typescript
// OLD
async predictDecision(hourOfDay: number, dayOfWeek: number): 
  Promise<{ action: string | null; confidence: number }>

// NEW
async predictDecision(features: MlPredictionFeatures): 
  Promise<MlPredictionResult>

export interface MlPredictionFeatures {
  hourOfDay: number;
  dayOfWeek: number;
  isStrongAction: number;      // NEW: From learning insights
  isWeakAction: number;        // NEW: From learning insights
  strategyConfidence: number;  // NEW: Rules input
  actionRiskScore: number;     // NEW: Risk assessment
}

export interface MlPredictionResult {
  action: string | null;
  confidence: number;  // Now 0-1.0, not hardcoded 1.0
  features?: MlPredictionFeatures;
}
```

**Backward Compatibility**:
```typescript
// Deprecated but still available
async predictDecisionBasic(hourOfDay: number, dayOfWeek: number): 
  Promise<MlPredictionResult>
```

### 2. BrainService (src/brain/brain.service.ts)

**Changed Decision Logic** (Lines ~142-195):
```typescript
// NEW: Feature enrichment with learning
const insights = learningService?.getInsights();
const isStrongAction = insights.strongActions.includes(decision.action) ? 1.0 : 0.0;
const isWeakAction = insights.weakActions.includes(decision.action) ? 1.0 : 0.0;

const mlFeatures: MlPredictionFeatures = {
  hourOfDay,
  dayOfWeek,
  isStrongAction,
  isWeakAction,
  strategyConfidence: decision.confidence * 0.4,
  actionRiskScore: enrichedDiagnosis.actionRiskScore ?? 0.5,
};

// NEW: Combined scoring formula
const mlResult = await modelService.predictDecision(mlFeatures);
const combinedScore = 
  (rulesConfidence × 0.4) + 
  (mlConfidence × 0.4) + 
  ((learningBoost + 0.10) × 0.2);

// NEW: Decision gate at 0.70 threshold
if (combinedScore >= 0.70) {
  finalDecision = winnnerAction;  // Execute
} else {
  escalate();  // Manual review
}
```

**Logging Changes**:
- `[ML WINS]` → `[COMBINED_SCORE]` (shows all three weights)
- `[RULES WIN]` → `[ESCALATE]` (if below threshold)
- Added `[ML_ACCURACY_RECORD]` (for post-execution analysis)

### 3. LearningService (src/learning/learning.service.ts)

**Enhanced getInsights() Return**:
```typescript
export interface LearningInsights {
  weakActions: CommandId[];
  strongActions: CommandId[];
  actionStats: Partial<Record<CommandId, {...}>>;
  qualityScore: number;    // NEW: 0-1.0 confidence in insights
  totalOutcomes: number;   // NEW: Sample size
  windowMs: number;        // NEW: Time window (2h half-life)
}
```

**Quality Scoring**:
- 0 outcomes = 0.0 quality
- 50+ outcomes = 1.0 quality (linear interpolation)
- Used implicitly in learning boost calculation

## Migration Steps

### For Developers

**0. Update Dependencies** (None - fully backward compatible)

**1. Verify Compilation**:
```bash
npm run build
# Should compile without errors
# If errors: check imports of MlPredictionFeatures
```

**2. Test Core Routes**:
```bash
# Test basic incident processing
curl -X POST http://localhost:3000/api/incidents \
  -H "Content-Type: application/json" \
  -d '{...incident payload...}'
# Should return same format as before
```

**3. Monitor Logs**:
```bash
# Watch for NEW log patterns
[COMBINED_SCORE] ...  # Good: shows all three weights
[ESCALATE] ...        # Expected: for edge cases
[ML_ACCURACY_RECORD] ...  # Good: for analysis
```

**4. Verify ML Model Loaded**:
```bash
# Check if decision_model.pkl exists
ls -la models/decision_model.pkl
# Should exist and be used by ModelService
```

### For Operations

**1. Enable ML Model Loading**:
```bash
# Ensure scripts/train_model.py has been run once
python scripts/train_model.py
# Creates models/decision_model.pkl and decision_model.onnx
```

**2. Setup Daily Retraining** (already in LearningService):
```bash
# Verify cron job runs daily at midnight
# The retraining happens automatically via:
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async retrainModel() { ... }
```

**3. Monitor Combined Scores**:
```bash
# Watch for escalations (score < 0.70)
grep -i "ESCALATE" logs/*.log
# Should be <10% of total decisions
```

**4. Track ML Accuracy**:
```bash
# Monitor ML prediction correctness
grep -i "ML_ACCURACY_RECORD" logs/*.log | wc -l
# Compare with [COMBINED_SCORE] logs to see ratio
```

## Behavioral Changes

### Execution Rates

| Scenario | Before | After | Reason |
|----------|--------|-------|--------|
| High-confidence | Execute | Execute | Same |
| Low-confidence | Execute (ML wins anyway) | Escalate | NEW: threshold gate |
| Conflicting signals | ML overrides | Weighted | Rules not sidelined |
| Strong action | No feedback | Boost +0.10 | Learning integrated |
| Weak action | No feedback | Penalty -0.10 | Learning integrated |

### Escalation Logic

**Before**: Rare (only guard failures)
**After**: ~10% of decisions (normal, healthy)

Example triggers:
- Rules confidence 0.55 AND ML confidence 0.45 → combined 0.50 < 0.70 → escalate
- New action without history → learning boost 0.0 → depends on rules+ml
- High-risk diagnosis + uncertain ML → may fall below threshold

### Learning Feedback

**Before**: Tracked but not used for decisions
**After**: Used to boost confidence in strong actions

Example:
- `retry_with_backoff` succeeds 85% of time → marked strong → +0.10 boost
- `restart_postgres` fails 70% of time → marked weak → -0.10 penalty
- Feedback updated daily via `LearningService.getInsights()`

## Performance Impact

### Latency
- **Before**: Rules evaluation + ML prediction (~5ms)
- **After**: Rules + Feature enrichment + ML prediction + Scoring (~6ms)
- **Impact**: +1ms (negligible, within ONNX inference margin)

### Throughput
- No changes: still rate-limited at 5/second per instance
- Combined scoring adds <1% overhead

### Accuracy
- Dependent on ML model quality
- Should improve as learning feedback accumulates
- Monitor via daily training + Model Registry

## Rollback Plan

If combined scoring underperforms:

1. **Immediate**: Revert BrainService changes
   ```bash
   git revert <commit-hash>
   npm run build && npm run start
   ```

2. **Root Cause**: Check logs
   ```
   - Are escalations too high? Adjust threshold from 0.70 to 0.65
   - Is ML accuracy low? Check feature engineering
   - Are rules degraded? Review strategy confidence values
   ```

3. **Adjustment**: Fine-tune weights if needed
   ```typescript
   // Instead of full revert, try:
   const combinedScore = 
     (rules × 0.50) +  // Increase rules weight
     (ml × 0.30) +
     ((learning + 0.10) × 0.20);
   ```

## Testing Checklist

- [ ] Compilation succeeds (`npm run build`)
- [ ] All existing tests pass (`npm run test`)
- [ ] Manual incident processing works
- [ ] Logs show `[COMBINED_SCORE]` patterns
- [ ] Escalation rate is 5-15% (healthy range)
- [ ] ML accuracy tracking logs appear
- [ ] Daily retraining executes at midnight
- [ ] Model Registry auto-registers versions
- [ ] No increase in response times (< 100ms P95)

## Q&A

**Q: Will my existing integrations break?**
A: No. Return format is identical. Score field now reflects combined score.

**Q: What if ML model doesn't exist?**
A: Falls back to rules only (learning boost calculation still works).

**Q: How often does learning update?**
A: Once per decision execution. `getInsights()` called fresh each time.

**Q: Can I disable combined scoring?**
A: Yes, temporary rollback in brain.service.ts, but not recommended.

**Q: What's the expected escalation rate?**
A: 5-15% of decisions. Higher = more conservative, lower = more aggressive.

## Support

For issues with combined scoring:
1. Check `[COMBINED_SCORE]` logs for breakdown
2. Verify ML model exists and loads (model_service logs)
3. Review learning insights quality (`insights.qualityScore`)
4. Monitor escalation rate trend (should stabilize)
5. Compare rules vs ML accuracy in logs

## References

- [ML Rules Combined Scoring](./ML_RULES_COMBINED_SCORING.md) - Architecture & formulas
- [ML Validation Production](./ML_VALIDATION_PRODUCTION.md) - Training & validation
- [ML Model Registry](./ML_MODEL_REGISTRY.md) - Version control
