# ML + Rules Combined Scoring System

## Overview

**Objetivo**: Eliminar dependencia de reglas como fallback primario. Implementar ML como fuente principal con reglas como validación en un sistema de scoring combinado.

**Arquitectura Nueva**:
```
Incident Input
    ↓
Input Guard (DataRules, SafetyRules, BookingRules) → Validar formato
    ↓
Router + Strategy Evaluation → rules_confidence (0.55-0.92)
    ↓
ML Feature Engineering ← Enriched by LearningService insights
    ↓
ML Model Prediction → ml_confidence (0-1.0 real)
    ↓
COMBINED SCORING ← Ensemble Ponderado
    score = (rules_conf × 0.4) + (ml_conf × 0.4) + (learning_boost × 0.2)
    ↓
Decision Gate: score ≥ 0.70 → Execute
Decision Gate: score < 0.70 → Escalate/Review
    ↓
Learning Feedback Loop ← Track ML accuracy
    ↓
Storage + Daily Retrain
```

## Architecture Changes

### Before (Problema)

```
BrainRouter → Strategy (confidence 0.55-0.92)
                    ↓ decision
ML Predictor ← (hardcoded 1.0 confidence)
                    ↓ mlResult
COMPARISON: if (1.0 > 0.92) → ML WINS (casi siempre)
```

**Problemas**:
- ML confidence hardcodeado a 1.0 → siempre gana
- LearningService.getInsights() nunca se usa
- No hay ensemble real
- Reglas no validan, no pesan

### After (Solución)

```
BrainRouter → Strategy (confidence 0.55-0.92)
                    ↓
                    ├─→ LearningService.getInsights() → strongActions[], weakActions[]
                    │
                    └─→ Enrich ML Features
                        ├─ hourOfDay, dayOfWeek
                        ├─ isStrongAction (1.0 if in insights.strongActions)
                        ├─ isWeakAction (1.0 if in insights.weakActions)
                        ├─ strategyConfidence (from decision)
                        └─ riskScore (from diagnosis)
                            ↓
                    ML Model Prediction (0-1.0 real confidence)
                            ↓
    COMBINED_SCORE = (rules_conf × 0.4) + (ml_conf × 0.4) + (learning_boost × 0.2)
                            ↓
    if (COMBINED_SCORE ≥ 0.70) → Execute
    else → Escalate/Review
```

## Scoring Formula

### Components

**1. Rules Confidence** (0.55-0.92)
- Strategy confidence from `ErrorStrategy`, `BookingStrategy`, `ScheduleStrategy`
- Input validation passed all guards
- Base credibility: rules are battle-tested

**2. ML Confidence** (0-1.0 real)
- ONNX model prediction (NOT hardcoded 1.0)
- Features enriched with `LearningService.getInsights()`
- Real uncertainty from classification

**3. Learning Boost** (±0.20)
- `+0.10`: Action is in `insights.strongActions` (>80% historical success rate)
- `-0.10`: Action is in `insights.weakActions` (>60% failure rate)
- `0.0`: Action has no historical record

### Calculation

```typescript
// pseudo-code
const rulesConfidence = decision.confidence;        // 0.55-0.92
const mlConfidence = mlResult.confidence;           // 0-1.0
const learningBoost = computeLearningBoost(
  decision.action, 
  insights.strongActions, 
  insights.weakActions
);  // -0.10 to +0.10

const combinedScore = 
  (rulesConfidence × 0.4) + 
  (mlConfidence × 0.4) + 
  ((learningBoost + 0.10) × 0.2);

// Weighted reasons
const weights = {
  rulesShare: (rulesConfidence * 0.4) / combinedScore,
  mlShare: (mlConfidence * 0.4) / combinedScore,
  learningShare: ((learningBoost + 0.10) * 0.2) / combinedScore
};

// Decision
finalDecision = combinedScore >= 0.70 ? winnerAction : escalate();
```

## Implementation Points in brain.service.ts

### 1. Feature Enrichment (Line ~142)

**Before**:
```typescript
// Only basic features
const basicFeatures = [hourOfDay, dayOfWeek, ...];
const mlResult = await this.modelService.predictDecision(basicFeatures);
```

**After**:
```typescript
// Enrich with learning insights
const insights = this.learningService.getInsights();
const isStrongAction = insights.strongActions.includes(decision.action) ? 1.0 : 0.0;
const isWeakAction = insights.weakActions.includes(decision.action) ? 1.0 : 0.0;

const enrichedFeatures = [
  hourOfDay,
  dayOfWeek,
  isStrongAction,              // NEW: Historical success signal
  isWeakAction,                // NEW: Historical failure signal
  decision.confidence,         // Rules confidence as feature
  enrichedDiagnosis.actionRiskScore
];

const mlResult = await this.modelService.predictDecision(enrichedFeatures, normalizedInput);
```

### 2. Combined Scoring (Line ~150)

**Before**:
```typescript
if (mlResult.confidence > decision.confidence) {
  finalDecision = mlResult;
} else {
  finalDecision = decision;
}
```

**After**:
```typescript
// Calculate learning boost
const learningBoost = 
  insights.strongActions.includes(decision.action) ? 0.10 :
  insights.weakActions.includes(decision.action) ? -0.10 : 
  0.0;

// Combined score formula
const combinedScore = 
  (decision.confidence * 0.4) +           // Rules: 40%
  (mlResult.confidence * 0.4) +           // ML: 40%
  ((learningBoost + 0.10) * 0.2);         // Learning: 20%, normalized to [0,0.2]

// Select action with highest combined score
const finalScores = [
  { action: decision.action, score: decision.confidence, source: 'rules' },
  { action: mlResult.action, score: mlResult.confidence, source: 'ml' }
];

const winnerScore = Math.max(...finalScores.map(s => s.score));
const winner = finalScores.find(s => s.score === winnerScore);

// Decision gate: 0.70 threshold
if (combinedScore >= 0.70 && winner.score >= 0.55) {
  finalDecision = {
    action: winner.action,
    confidence: combinedScore,
    reasoning: `Combined[Rules:${(decision.confidence * 0.4).toFixed(2)} + ML:${(mlResult.confidence * 0.4).toFixed(2)} + Learning:${((learningBoost + 0.10) * 0.2).toFixed(2)}]`,
    sources: {
      rules: { action: decision.action, confidence: decision.confidence },
      ml: { action: mlResult.action, confidence: mlResult.confidence },
      learning: { boost: learningBoost, quality: insights.qualityScore }
    }
  };
} else {
  // Below threshold - escalate to team
  finalDecision = {
    action: 'ESCALATE',
    confidence: combinedScore,
    reasoning: `Confidence ${combinedScore.toFixed(2)} below 0.70 threshold. Review suggested.`,
    sources: { rules: decision, ml: mlResult, learning: learningBoost }
  };
}
```

### 3. Feedback Loop (Line ~204)

**Addition**: Track ML accuracy for continuous improvement

```typescript
// After execution result
const mlAccuracyRecord = {
  timestamp: new Date(),
  incident: normalizedInput,
  mlPrediction: {
    action: mlResult.action,
    confidence: mlResult.confidence,
    features: enrichedFeatures
  },
  finalDecision: finalDecision.action,
  combinedScore: combinedScore,
  executionResult: executionResult.executed,
  outcome: executionResult.executed ? 'success' : 'failure',
  mlWasCorrect: (mlResult.action === winner.action && executionResult.executed),
  rulePrediction: {
    action: decision.action,
    confidence: decision.confidence
  },
  ruleWasCorrect: (decision.action === winner.action && executionResult.executed)
};

// Persist ML accuracy (separate from learning)
await this.persistMlAccuracy(mlAccuracyRecord);

// Record to learning service
this.learningService?.record(normalizedInput, finalDecision, executionResult);
```

## File Changes Required

### 1. src/brain/brain.service.ts
**Changes**:
- Line ~100: Expose `learningService` (already injected)
- Line ~142: Add feature enrichment with `getInsights()`
- Line ~150: Implement combined scoring formula
- Line ~204: Add ML accuracy tracking
- Add new interface: `CombinedScoreResult`

**Lines affected**: ~142, ~150, ~204

### 2. src/learning/learning.service.ts
**Changes**:
- Ensure `getInsights()` returns correct format:
  ```typescript
  interface LearningInsights {
    strongActions: string[];        // >80% success rate
    weakActions: string[];          // >60% failure rate
    qualityScore: number;           // 0-1.0 confidence in insights
    totalOutcomes: number;
    timeWindowMs: number;           // recency weight (2h half-life)
  }
  ```
- Add method: `recordMlAccuracy(record)` for separate ML tracking

### 3. src/integration/metabrain.handler.ts
**No changes** (receives finalDecision with new scoring info)

### 4. docs/ML_VALIDATION_PRODUCTION.md
**Changes**:
- Update "Integration with Learning Service" section
- Add "Combined Scoring" subsection
- Update deployment gates with new 0.70 threshold
- Document escalation logic

## Weights Rationale

- **Rules: 40%** - Input validation + strategy pattern matching are reliable
- **ML: 40%** - Trained on actual outcomes, captures temporal patterns
- **Learning: 20%** - Recent historical effectiveness, exponential decay filters noise

**Why equal rules + ML?**
- Rules provide structured validation (guard rails)
- ML provides pattern recognition (decision optimization)
- Neither dominates; they validate each other

## Decision Thresholds

| Scenario | Threshold | Action |
|----------|-----------|--------|
| All signals aligned | combinedScore ≥ 0.70 | Execute immediately |
| Minor conflict | 0.60 ≤ combinedScore < 0.70 | Execute with monitoring |
| Major conflict | combinedScore < 0.60 | Escalate to team |
| Rules failed | decision.confidence < 0.55 | BLOCKED (unchanged) |

## Benefits

### 1. ML as Primary Source
- Not sidelined by hardcoded 1.0 → real uncertainty quantified
- Enriched with learning feedback → improves over time
- Participates equally in decision (40% weight)

### 2. Rules as Validation
- Guard rails still active (input validation)
- Participate in ensemble (40% weight)
- Can veto low-confidence ML predictions via combined score

### 3. Learning Feedback Loop
- Strong/weak actions influence incoming decisions
- Creates virtuous cycle: better predictions → better learning
- Separate ML accuracy tracking reveals model drift

### 4. Interpretability
- Each decision includes weights breakdown
- Teams see WHY (rules 40%, ML 40%, learning 20%)
- Audit trail for compliance

## Implementation Timeline

**Phase 1 (Day 1)**:
- [ ] Update `brain.service.ts` lines 142, 150, 204
- [ ] Test combined scoring with mock data
- [ ] Verify threshold behavior (≥0.70 execute, <0.70 escalate)

**Phase 2 (Day 2)**:
- [ ] Update `learning.service.ts` getInsights() format
- [ ] Add `recordMlAccuracy()` method
- [ ] Test learning boost calculation

**Phase 3 (Day 3)**:
- [ ] Monitor first 100 decisions
- [ ] Verify ML accuracy tracking works
- [ ] Adjust weights if needed (e.g., 0.35/0.45/0.20)

**Phase 4 (Week 2)**:
- [ ] Analyze ML accuracy reports
- [ ] Compare decision quality (combined vs old)
- [ ] Document results

## Monitoring & Validation

### Metrics to Track

```typescript
interface ScoringMetrics {
  combinedScoreDistribution: {
    mean: number;
    std: number;
    percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  };
  executionRates: {
    aboveThreshold: number;     // ≥0.70
    belowThreshold: number;     // <0.70
  };
  componentContribution: {
    rulesWeight: number;        // avg 40%
    mlWeight: number;           // avg 40%
    learningWeight: number;     // avg 20%
  };
  mlAccuracy: {
    mlCorrect: number;          // ML was right
    mlWrong: number;            // ML was wrong
    rulesCorrect: number;       // Rules was right
    rulesWrong: number;         // Rules was wrong
    ensembleCorrect: number;    // Combined was right
  };
}
```

### Dashboards (Future)

- **Decision Breakdown**: Rules vs ML vs Learning contribution pie chart
- **ML Accuracy Trend**: Daily % correct predictions (should improve with learning)
- **Decision Distribution**: Histogram of combinedScore values
- **Escalation Rate**: % of decisions below 0.70 threshold
- **Action Effectiveness**: Top actions by combined success rate

## Rollback Plan

If combined scoring underperforms:
1. Revert `brain.service.ts` changes (keep backup)
2. Return to previous comparison logic (if ML > rules, else rules)
3. Keep ML accuracy logging for post-mortem analysis
4. Investigate why ensemble wasn't better (overfitting? bad weights? feature engineering?)

## References

- [ML Model Registry](./ML_MODEL_REGISTRY.md) - Version control for models
- [ML Validation Production](./ML_VALIDATION_PRODUCTION.md) - Training and validation
- [Architecture ML Analysis](./ARCHITECTURE_ML_ANALYSIS.md) - Detailed component breakdown
