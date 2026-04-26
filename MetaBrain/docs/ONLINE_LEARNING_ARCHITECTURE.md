# MetaBrain Online Learning Architecture

## Overview

Conversión de MetaBrain de **reentrenamiento batch diario** a **aprendizaje online/near-real-time** sin romper la arquitectura existente.

**Estado**: FASES 1-4 COMPLETADAS ✅  
**Siguientes**: FASES 5-7 (Hot swap, Drift detection, Seguridad)

---

## Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────┐
│                    SISTEMA METABRAIN                            │
│                   (Batch → Online Learning)                     │
└─────────────────────────────────────────────────────────────────┘

FASE 1: CAPTURA EN TIEMPO REAL
┌─────────────────────────────────────────────────────────────────┐
│ Brain Service (decisión)                                        │
│   ↓ (fire-and-forget)                                           │
│   PersistenceService.saveOnlineTrainingRecord() ────────────┐   │
│                                                              │   │
│ Persiste:                                                    │   │
│  - incidentId, source                                        │   │
│  - input (payload completo)                                 │   │
│  - featureMap (dict de features)                            │   │
│  - onnxFeatureVector (array exacto usado)                   │   │
│  - mlPrediction (action, confidence, topFeatures)           │   │
│  - finalAction, finalConfidence (decisión final)            │   │
│  - timestamp de decisión                                    │   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│            MongoDB: online_training_buffer                      │
│                                                                 │
│ Collection: online_training_buffer                             │
│ ├─ UsedInTraining: false (nuevo)                              │
│ ├─ Indices: (incidentId, createdAt, usedInTraining)          │
│ └─ Esquema: OnlineTrainingBuffer (v. linea 1-128)            │
└─────────────────────────────────────────────────────────────────┘

FASE 2: CONSISTENCIA DE FEATURES (OBLIGATORIO)
┌─────────────────────────────────────────────────────────────────┐
│ Feature Builder                                                 │
│  ↓                                                              │
│  - Mismo orden de features (idx en array)                     │
│  - Mismos encoders cargados                                   │
│  - Misma normalización                                        │
│                                                                │
│ Validación: getFeatureIndex() devuelve posición exacta       │
└─────────────────────────────────────────────────────────────────┘

FASE 3: MICRO-BATCH LEARNING (cada 5 min)
┌─────────────────────────────────────────────────────────────────┐
│ OnlineLearningService                                           │
│ @Cron(EVERY_5_MINUTES)                                         │
│   ↓                                                              │
│   getUntrainedBufferRecords(limit=1000, quality=true)         │
│     Filtros:                                                   │
│      - realOutcome != null                                    │
│      - featureVector sin NaN                                 │
│      - confidence >= 0.60                                    │
│   ↓                                                              │
│   shouldTriggerRetrain() checks:                              │
│     - ≥ 20 records con outcome                               │
│     - Throttle: mín 30 min desde último retrain              │
│   ↓                                                              │
│   exportIncrementalDataset() → CSV temporal                   │
│                                                                │
│ Output: data/incremental/training_buffer_<timestamp>.csv     │
└─────────────────────────────────────────────────────────────────┘

FASE 4: RETRAINING INCREMENTAL + GATE
┌─────────────────────────────────────────────────────────────────┐
│ OnlineLearningService                                           │
│   ↓                                                              │
│   python scripts/train_model_incremental.py <buffer.csv>       │
│     ├─ Carga: X_train_hist.csv + incremental                  │
│     ├─ Combina: features aligned                              │
│     ├─ Entrena: RandomForest (100 trees, cv=5)               │
│     ├─ Evalúa: Accuracy, Overfitting, CV                     │
│     ├─ DEPLOYMENT GATE (línea ~410-430)                      │
│     │   ├─ test_accuracy >= 0.70  ✓                           │
│     │   ├─ overfitting < 0.30     ✓                           │
│     │   ├─ cv_available           ✓                           │
│     │   └─ onnx_parity == 1.0     ✓                           │
│     │                                                          │
│     │   IF ALL PASS:                                          │
│     │     ├─ Save decision_model.onnx                        │
│     │     ├─ Export metadata + feature importance            │
│     │     ├─ Register in registry.json (vX)                  │
│     │     └─ Mark buffer records as usedInTraining=true      │
│     │                                                          │
│     │   ELSE:                                                 │
│     │     └─ DEPLOYMENT BLOCKED (pero artifacts guardados)   │
│     │                                                          │
│     └─ Output: DEPLOYMENT_GATE_PASSED | BLOCKED              │
│                                                                │
│ Gate Report: models/reports/incremental_gate_report.json      │
└─────────────────────────────────────────────────────────────────┘

════════════════════════════════════════════════════════════════════

PROXIMAS FASES (Roadmap)

FASE 5: HOT SWAP DE MODELO
┌─────────────────────────────────────────────────────────────────┐
│ MlCoreModelLoader (dynamic reload)                             │
│  └─ Implementar:                                               │
│     - Polling periódico de decision_model.onnx                │
│     - Cache versioning                                        │
│     - Reload sin reiniciar app                               │
│                                                                │
│ API Endpoint: POST /api/ml/reload-model                       │
│  └─ Trigger manual reload de artefactos                       │
└─────────────────────────────────────────────────────────────────┘

FASE 6: DRIFT DETECTION
┌─────────────────────────────────────────────────────────────────┐
│ DriftDetectionService (nuevo)                                  │
│  └─ Comparar distribución actual vs training:                │
│     - Jensen-Shannon divergence por feature                   │
│     - Threshold: JS > 0.15 → DRIFT DETECTED                  │
│     - Trigger: retraining prioritario                        │
└─────────────────────────────────────────────────────────────────┘

FASE 7: SEGURIDAD
┌─────────────────────────────────────────────────────────────────┐
│ OnlineLearningService.validateDataQuality()                    │
│  └─ Prevenciones:                                              │
│     - Mínimo 5 muestras por clase                             │
│     - Detección de malformed records                          │
│     - Rollback automático si modelo degrada                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flujo Detallado: De Predicción a Reentrenamiento

### 1️⃣ Predicción en Runtime

```typescript
// BrainService.orchestrate()
  → ModelService.predictDecision()
    → FeatureBuilder.buildFeatures()  [FASE 2]
    → MlCorePredictorService.predict()
      → ONNX inference
      → Calibration
      → topFeatures calculation
  ← Retorna: MlPredictionResult
    {
      action, confidence,
      source ('ML'|'HYBRID'|'RULES'),
      featureVector,
      topFeatures[]
    }
```

### 2️⃣ Captura de Feedback (FASE 1)

```typescript
// BrainService.orchestrate() [linea ~280-310]
  → PersistenceService.saveOnlineTrainingRecord()
    {
      incidentId: "incident-123",
      source: "system",
      input: IncidentPayload,
      featureMap: { hour_of_day: 14, ... },
      onnxFeatureVector: [0.5, 0.3, ...],
      featureNames: ['hour_of_day', 'day_of_week', ...],
      mlPrediction: {
        modelAction: 'ESCALATE',
        modelConfidence: 0.95,
        mlSource: 'ML',
        topFeatures: [
          { feature: 'strategy_encoded', value: 2.0, score: 0.2768 },
          ...
        ]
      },
      finalAction: 'ESCALATE',
      finalConfidence: 0.95,
      modelVersion: 'v15',
      qualityMetadata: {
        hasCompleteFeatures: true,
        hasValidOutput: false,  // Pending outcome
        isSufficientlyConfident: true,
        isFromEarlyTraining: false
      }
    }
```

MongoDB guarda el record. Cuando llega el outcome, se actualiza:

```json
{
  "realOutcome": {
    "outcome": "success",
    "executed": true
  },
  "outcomeTimestamp": "2026-04-19T21:30:45Z",
  "qualityMetadata": {
    "hasValidOutput": true  // ← Ahora es ready para training
  }
}
```

### 3️⃣ Trigger de Micro-Batch (FASE 3)

```typescript
// OnlineLearningService.triggerMicroBatchLearning()
// @Cron(EVERY_5_MINUTES)

Stats:
  totalRecords: 500
  untrainedRecords: 150
  recordsWithOutcome: 75  (≥ MIN_UNTRAINED_WITH_OUTCOME = 20) ✓
  timeSinceLastRetrain: 35 min (≥ MIN_RETRAIN_INTERVAL = 30 min) ✓

Decision: shouldRetrain = true
  ↓
  exportIncrementalDataset()
    ├─ Query: { usedInTraining: false, qualityMetadata.hasValidOutput: true }
    ├─ Flatten a CSV with columns:
    │   incidentId | source | outcome | executed | hour_of_day | ... | target_action
    └─ Guardado en: data/incremental/training_buffer_2026-04-19T213045Z.csv
```

### 4️⃣ Reentrenamiento Incremental (FASE 4)

```bash
python scripts/train_model_incremental.py data/incremental/training_buffer_2026-04-19T213045Z.csv

Proceso:
  1. load_historical_data()
     ├─ X_train_hist: 168 samples, 37 features
     └─ y_train_hist: [A, B, C, D] labels

  2. load_incremental_data()
     ├─ Carga CSV desde buffer
     ├─ Extrae features + target_action
     └─ X_incr: 75 samples

  3. combine_datasets()
     ├─ Align features (feature_cols comunes)
     ├─ Concatena: X_combined = 243 samples
     └─ y_combined = [A, B, C, D] + [A, B, C]

  4. train_incremental_model()
     ├─ RandomForest(n_estimators=100, ...)
     ├─ Cross-validate (cv=5)
     ├─ CV Accuracy: 0.9844 ± 0.0127
     └─ No overfitting detected

  5. evaluate_incremental_model()
     ├─ Test Accuracy: 0.9722
     ├─ Test Precision: 0.9722
     └─ Test Recall: 0.9722

  6. DEPLOYMENT GATE  [CRÍTICO]
     ├─ test_accuracy = 0.9722 >= 0.70 ✓ PASS
     ├─ overfitting = 0.0278 < 0.30 ✓ PASS
     ├─ cv_available = true ✓ PASS
     ├─ onnx_parity = 1.0 == 1.0 ✓ PASS
     │
     RESULT: DEPLOYMENT GATE PASSED
       ↓
     7. export_onnx_metadata()
        ├─ Save decision_model.onnx
        ├─ Save onnx_metadata.json
        │  {
        │    "pipeline_version": "ml-pipeline-v1",
        │    "feature_schema_version": "ml-pipeline-v1:39",
        │    "top_features_global": [...],
        │    "ml_primary": 0.9244,
        │    "hybrid_min": 0.7464
        │  }
        └─ Compute dynamic_threshold_caps(75)  ← Based on val_n

     8. register_model()
        ├─ Version: v16
        ├─ Status: STAGING
        └─ Registry entry: { v16: 0.9722, features: ... }

     9. markBufferRecordsAsUsed()
        ├─ UPDATE online_training_buffer
        ├─ SET usedInTraining = true
        ├─ WHERE incidentId IN [...]
        └─ Previene reutilización

════════════════════════════════════════════════════════════════════
```

---

## Archivos Creados/Modificados

### NUEVOS

| Archivo | FASE | Descripción |
|---------|------|-------------|
| `src/persistence/schemas/online-training-buffer.schema.ts` | 1 | Schema MongoDB para capturar feedback |
| `src/ml/online-learning.service.ts` | 3-4 | Orquestador de micro-batch + reentrenamiento |
| `scripts/train_model_incremental.py` | 4 | Pipeline Python para reentrenamiento incremental |

### MODIFICADOS

| Archivo | FASE | Cambios |
|---------|------|---------|
| `src/persistence/persistence.module.ts` | 1 | Registra OnlineTrainingBuffer schema |
| `src/persistence/persistence.service.ts` | 1 | Métodos `saveOnlineTrainingRecord()`, `getUntrainedBufferRecords()`, etc. |
| `src/brain/brain.service.ts` | 1 | Captura feedback with `persistenceService.saveOnlineTrainingRecord()` |
| `src/ml/model.service.ts` | 1 | Getters `getModelVersion()`, `getFeatureBuilder()` |
| `src/ml-core/predictor.service.ts` | 1 | Getter `getModelVersion()` para versionado |
| `src/ml/ml.module.ts` | 3 | Registra OnlineLearningService + ScheduleModule |

---

## Condiciones de Reentrenamiento (Thresholds)

```typescript
// OnlineLearningService.shouldTriggerRetrain()
const MIN_UNTRAINED_WITH_OUTCOME = 20;      // Mínimo records con feedback
const MIN_RETRAIN_INTERVAL_MS = 30 * 60 * 1000;  // 30 min entre retrains

// train_model_incremental.py (Gate)
const DEPLOYMENT_GATE_MIN_TEST_ACCURACY = 0.70;
const DEPLOYMENT_GATE_MAX_OVERFITTING = 0.30;
```

---

## Pruebas Recomendadas

```bash
# 1. Verificar schema MongoDB
mongo metabrain
> db.online_training_buffer.find().limit(1)

# 2. Trigger manual de reentrenamiento
curl -X POST http://localhost:3000/api/ml/online-learning/trigger

# 3. Ver estado del servicio
curl http://localhost:3000/api/ml/online-learning/status

# 4. Inspeccionar reporte del gate
cat models/reports/incremental_gate_report.json

# 5. Verificar versión del modelo entrenado
cat models/registry.json | jq '.versions | reverse | .[0]'
```

---

## Próximos Pasos (FASES 5-7)

### FASE 5: Hot Swap
- [ ] Modifi `MlCoreModelLoader.reloadModel()` para polling periódico
- [ ] Endpoint `POST /api/ml/reload-model` para reload manual
- [ ] Cache versioning (evitar reloads innecesarios)

### FASE 6: Drift Detection
- [ ] Crear `DriftDetectionService` (Jensen-Shannon divergence)
- [ ] Integrar con OnlineLearningService para trigger automático
- [ ] Alertas cuando JS > 0.15

### FASE 7: Seguridad
- [ ] Validaciones de data quality (mín samples por clase)
- [ ] Detección de malformed records en buffer
- [ ] Rollback automático si model accuracy degrada

---

## Resumen: Nivel de Autonomía

**ANTES**: Batch manual diario  
**DESPUÉS**: Semi-autónomo nivel 4+ (self-improving)

✅ Captura automática de feedback  
✅ Identifica automáticamente cuando reentrenar  
✅ Valida automáticamente cada modelo  
✅ Rechaza automáticamente modelos no confiables  
🔲 Detección de drift (FASE 6)  
🔲 Hot swap sin downtime (FASE 5)  
🔲 Rollback automático (FASE 7)  

---

**Documento generado**: 2026-04-19  
**Status**: FASES 1-4 COMPLETADAS, FASES 5-7 PENDIENTES  
**Siguiente revisión**: Después de prueba en staging con datos reales
