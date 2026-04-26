# MetaBrain

Arquitectura base real para analizar incidentes, extraer errores y ejecutar reparaciones controladas.

## Características

- **Sistema Híbrido ML + Reglas**: Integra Machine Learning para decisiones óptimas basadas en datos históricos, con fallback a reglas hardcodeadas.
- **Aprendizaje Continuo**: Reentrena modelos diariamente con nuevos datos.
- **Arquitectura Modular**: Módulos desacoplados para brain, action-engine, guard, events, etc.
- **Event-Driven**: Procesamiento asíncrono con Kafka/RabbitMQ.
- **Observabilidad**: Logging detallado de predicciones ML vs reglas.

## Runtime Recomendado

- **Python recomendado para MetaBrain/Groq:** `3.12`
- **Rango soportado:** `3.11` a `3.13`
- **Evitar para producción con Groq:** `3.14+`, porque el SDK emite warnings de compatibilidad parcial aunque pueda funcionar

## Machine Learning Integration

### Fases Implementadas

1. **Ingeniería de Datos Mejorada** (`scripts/data_pipeline.py`):
   - Parseo de `incidents.json`, `outcomes.json`, `audit.json`
   - Features enriquecidas: severity, logs_count, metrics_count, frequency, encodings categóricos
   - Label: acción recomendada, éxito

2. **Entrenamiento con Validación** (`scripts/train_model.py`):
   - Modelo: RandomForestClassifier
   - Validación: Cross-validation, matriz confusión, classification report
   - Versionado: Solo guarda si mejora accuracy previa
   - Export: `models/decision_model.onnx`

3. **Integración Backend** (`src/ml/`):
   - `ModelLoader`: Carga modelo ONNX al iniciar
   - `Predictor`: Inferencia con confianza
   - `ModelService`: API para predicciones

4. **Sistema Híbrido Competitivo** (`brain.service.ts`):
   - ML compite con reglas por máxima confianza
   - Logging: `[ML WINS]` vs `[RULES WIN]`

5. **Aprendizaje Continuo Seguro** (`learning.service.ts`):
   - Reentrenamiento diario con validación
   - Rollback automático si modelo degrada

### Mejoras Críticas Abordadas

- ✅ **Overfitting**: Cross-validation y métricas robustas
- ✅ **Features Pobres**: 18 features contextuales vs 2 iniciales
- ✅ **Subordinación ML**: Competencia independiente por confianza
- ✅ **Reentrenamiento Peligroso**: Validación antes de reemplazar
- ✅ **Separación ML**: Módulo desacoplado, listo para microservicio
- ✅ **Contexto Real**: Historial, frecuencia, tasa de éxito previas

## ML Service Independiente

### Arquitectura

Se ha implementado un **microservicio ML independiente** (`src/ml-service/`) para escalabilidad y mantenimiento profesional:

- **API REST**: Endpoints dedicados para predicciones (`/ml/predict`)
- **Carga Dinámica de Modelos**: ONNX runtime con gestión de memoria LRU
- **Registro de Versiones**: Sistema de versiones production/staging
- **Tolerancia a Fallos**: Fallback a reglas cuando modelos no disponibles
- **Métricas y Health Checks**: Monitoreo del estado del servicio

### Endpoints

```bash
GET  /ml/health          # Estado del servicio
GET  /ml/versions        # Versiones disponibles
GET  /ml/metrics         # Estadísticas de uso
POST /ml/predict         # Predicción individual
POST /ml/batch-predict   # Predicciones por lotes
```

### Ejemplo de Uso

```bash
# Health check
curl http://localhost:3001/ml/health

# Predicción
curl -X POST http://localhost:3001/ml/predict \
  -H "Content-Type: application/json" \
  -d '{
    "incidentId": "incident-123",
    "features": {
      "hourOfDay": 14,
      "dayOfWeek": 2,
      "isStrongAction": false,
      "isWeakAction": true,
      "strategyConfidence": 0.8,
      "actionRiskScore": 0.3
    }
  }'
```

### Configuración

- **Registro de Modelos**: `data/model-registry.json`
- **Modelos**: `data/models/*.onnx`
- **Límite de Memoria**: Máximo 5 modelos cargados simultáneamente
- **TTL de Modelos**: 30 minutos de inactividad

### Flujo Actual

```
evento → [ML prediction] + [Rules decision] → Máxima confianza → Acción
```

### Features Contextuales (18 total)

**Temporales** (3): hour_of_day, day_of_week, time_since_last_min

**Historial** (2): frequency_1h, frequency_1d

**Contexto** (4): logs_count, metrics_count, has_data, source_category

**Acciones** (2): action_historical_success_rate, type_action_success_rate

**Categóricas** (8): incident_type, source, diagnosis_code, severity, strategy, action_type, original_type, source_category

Ver [docs/ML_FEATURES.md](docs/ML_FEATURES.md) para detalles completos.

Para ejemplos de mejoras prácticas: [docs/CONTEXT_ENRICHMENT.md](docs/CONTEXT_ENRICHMENT.md)

## ML Validation & Production Readiness

MetaBrain implementa un sistema comprehensivo de validación para evitar overfitting, detectar degradación del modelo y garantizar confiabilidad en producción.

### Pipeline de Validación

```
Data → Features (18) → Train/Test Split (80/20) → Training
                                                        ↓
                            ┌───────────────┬──────────┼──────────┬──────────────┐
                            ↓               ↓          ↓          ↓              ↓
                    Cross-Validation  Confusion   Overfitting  Precision    Recall
                    (Stratified K-Fold) Matrix    Detection    Score        Score
                            ↓               ↓          ↓          ↓              ↓
                            └───────────────┴──────────┼──────────┴──────────────┘
                                                       ↓
                                            Production Readiness Report
```

### Scripts de Validación

1. **`scripts/data_pipeline.py`**: Ingeniería de features (18 features contextuales)
2. **`scripts/train_model.py`**: Entrenamiento con métricas comprehensivas
3. **`scripts/validate_model.py`**: Reporte de validación y overfitting detection
4. **`scripts/model_monitor.py`**: Monitoreo de degradación en producción  
5. **`scripts/run_ml_validation.py`**: Pipeline orquestada (data → train → validate → monitor)

### Ejecución

```bash
# Pipeline completo: data → train → validate → monitor
python scripts/run_ml_validation.py

# Pasos individuales
python scripts/data_pipeline.py      # Generar features
python scripts/train_model.py        # Entrenar con validación
python scripts/validate_model.py     # Reporte de overfitting
python scripts/model_monitor.py      # Health check de producción
```

### Métricas Clave

**Overfitting Detection** (train accuracy - test accuracy):
- ✓ **EXCELLENT** (<0.05): Sin overfitting, buena generalización
- ✓ **GOOD** (<0.15): Overfitting ligero, aceptable
- ⚠ **WARNING** (<0.30): Overfitting moderado, monitorear
- ✗ **CRITICAL** (≥0.30): Overfitting severo, modelo no confiable

**Production Readiness Score** (0-100):
- ≥80 points: ✓ LISTO PARA PRODUCCIÓN
- 60-79 points: ⚠ PRECAUCIÓN - Monitorear en prod
- 40-59 points: ⚠ LIMITADO - Usar con restricciones
- <40 points: ✗ NO LISTO - Necesita mejoras

**Métricas Tracked**:
- Test Accuracy, Precision, Recall, F1-Score
- Cross-Validation mean/std (StratifiedKFold)
- Confusion Matrix, True Positives/False Positives
- Data Distribution & Model Age

### Arquivos Generados

```
models/
├── decision_model.pkl          # Modelo scikit-learn
├── decision_model.onnx         # Export ONNX para Node.js
├── model_metrics.json          # Métricas comprehensivas
├── confusion_matrix.json       # Matriz de confusión + stats
└── monitoring/
    └── latest_health_check.json

data/processed/
├── X_train.csv, X_test.csv     # Features
├── y_train.csv, y_test.csv     # Labels
├── feature_names.txt           # Catálogo de features
├── feature_encoders.pkl        # Categorical encoders
└── action_encoder.pkl          # Action label encoder
```

### Documentación Completa

- [docs/ML_VALIDATION_PRODUCTION.md](docs/ML_VALIDATION_PRODUCTION.md): Validación exhaustiva, sanity checks, troubleshooting
- [docs/ML_VALIDATION_INTEGRATION.md](docs/ML_VALIDATION_INTEGRATION.md): Integración en CI/CD, monitoring dashboards, alertas

## Model Evolution & Version Control

MetaBrain implementa un sistema de **Model Registry** para controlar la evolución segura de modelos con versionado automático, comparación inteligente y rollback seguro.

### ML as Primary Decision Source

**Cambio Arquitectónico**: ML es ahora la fuente principal, no fallback de reglas.

```
Input → Rules Validation (Guard) → Strategy (Baseline)
                                        ↓
                        Learning Insights (Historical Data)
                                        ↓
                        ML Features Enrichment + Prediction
                                        ↓
                    COMBINED SCORING: Rules (40%) + ML (40%) + Learning (20%)
                                        ↓
                        Combined Score ≥ 0.70? → Execute
                        Combined Score < 0.70? → Escalate
```

**Evolución vs Arquitectura Anterior**:
- **Antes**: ML vs Rules (comparación). ML con confidence hardcodeado (1.0).
- **Ahora**: ML + Rules (ensemble). ML con confidence real (0-1.0). Learning feedback.

### Pipeline de Evolución

```
Training → Register (v1, v2, v3) → Compare vs Prod → Recommend (DEPLOY/REJECT)
                                        ↓
                            ✓ DEPLOY (+3% acc) → PRODUCTION
                            ⚠ CAUTION (review) → manual check
                            ✗ REJECT (-5% acc) → blocked
                                        ↓
                    Combined Scoring Decision (Live)
                                        ↓
                        Monitoring + Learning Feedback
                                        ↓
                            Degradation Detected
                                        ↓
                                Automatic Rollback
```

### Características

1. **Combined Scoring Engine** (`src/brain/brain.service.ts`)
   - Pesa Rules (40%), ML (40%), Learning (20%)
   - Features enriquecidas: historical strong/weak actions
   - Threshold 0.70 para decisiones seguras
   - Escalation para <0.70 (manual review)

2. **ML as Primary Source** 
   - ML confidence real (0-1.0), no hardcodeado
   - Enriquecido con insights históricos
   - Participates equally with rules (40% cada uno)
   - Learning boost contribuye con feedback

3. **Model Registry** (`scripts/model_registry.py`)
   - Registra automáticamente cada versión (v1, v2, v3...)
   - Almacena en directorio: `models/vN/`
   - Tracks: accuracy, F1, overfitting, CV stats, timestamp
   - Estados: STAGING → PRODUCTION → SUPERSEDED → REJECTED

4. **Automatic Comparison** (`scripts/model_compare.py`)
   - Compara vs producción en 4 dimensiones:
     * Accuracy improvement (≥2% = good, -5% = tolerable, >-5% = fail)
     * Overfitting change (more overfitting bad)
     * CV stability (low variance = good)
     * Data quality (more samples = good)
   - Confidence score 0-1.0
   - Recomendación: DEPLOY / DEPLOY_WITH_CAUTION / REVIEW / REJECT

5. **Safe Rollback** (`scripts/model_rollback.py`)
   - Rollback manual a cualquier versión anterior
   - Rollback automático si accuracy cae >10%
   - O degradation detectada en scoring combinado
   - Copia archivos de `models/vN/` a `models/`
   - Actualiza registry con razón y timestamp

6. **Registry Structure** (`models/registry.json`)
   ```json
   {
     "versions": [
       {"version": "v1", "test_accuracy": 0.88, "status": "PRODUCTION", ...},
       {"version": "v2", "test_accuracy": 0.92, "status": "STAGING", ...}
     ],
     "current_production": "v1",
     "history": [
       {"event": "registered", "version": "v1", ...},
       {"event": "promoted_to_production", "version": "v1", ...}
     ]
   }
   ```

### Combined Scoring Formula

```
score = (rules_confidence × 0.4) + (ml_confidence × 0.4) + (learning_boost + 0.10) × 0.2

Donde:
- rules_confidence: 0.55-0.92 (from strategy evaluation)
- ml_confidence: 0-1.0 (REAL, from trained model)
- learning_boost: -0.10 to +0.10 (historical effectiveness)
```

**Decision Thresholds**:
- ≥0.70: Execute immediately + monitoring
- <0.70: Escalate to team + manual review

### Commands

```bash
# Entrenamiento auto-registra y valida modelo
python scripts/train_model.py
# → Registra v2, compara vs v1, genera recomendación

# Rollback manual
python scripts/model_rollback.py v1 "Reason: degradation detected"
# → Restaura v1 a PRODUCTION

# Ver historial + scoring
python -c "from model_registry import ModelRegistry; \
  r = ModelRegistry(); r.print_history()"

# Demo completa
python scripts/demo_model_registry.py
# → Simula 3 ciclos: v1→v2 (deploy), v3 (reject), rollback
```

### Documentación

- [docs/ML_RULES_COMBINED_SCORING.md](docs/ML_RULES_COMBINED_SCORING.md): Arquit combinada, decisión gates, thresholds
- [docs/ML_MODEL_REGISTRY.md](docs/ML_MODEL_REGISTRY.md): Version control, comparación, rollback
- [docs/MODEL_EVOLUTION_SUMMARY.md](docs/MODEL_EVOLUTION_SUMMARY.md): Resumen ejecutivo
- [docs/ML_VALIDATION_PRODUCTION.md](docs/ML_VALIDATION_PRODUCTION.md): Validación, testing, monitoring

## Uso Completo del Pipeline ML + Decision Intelligence

```
### 1. Initial Setup (Una sola vez)

bash
# Instalar dependencias Python + entrenar modelo base
python scripts/data_pipeline.py
python scripts/train_model.py
# → Crea models/decision_model.pkl y registry.json

### 2. Uso Normal (Operación diaria)

bash
# Iniciar app (carga modelo automáticamente)
npm run start:dev

# App ahora usa:
# - Rules (40%) para validación e estrategias base
# - ML (40%) con features enriquecidas por histórico
# - Learning (20%) para feedback de acciones históricas

### 3. Monitoreo

bash
# Ver decisiones actuales
tail -f logs/app.log | grep "COMBINED_SCORE"

# Ver escalaciones (baja confianza)
tail -f logs/app.log | grep "ESCALATE"

# Ver accuracy tracking
grep "ML_ACCURACY_RECORD" logs/app.log | head -20

### 4. Reentrenamiento automático

# Sucede diariamente a medianoche (cron job)
# Visible en logs:
tail -f logs/app.log | grep "Learning.*Retraining"

# Manual: ejecutar en cualquier momento
python scripts/train_model.py
# → v2 registrado automáticamente, comparado con v1

### 5. Gestión de Versiones

bash
# Ver historial de versiones
python -c "from model_registry import ModelRegistry; \
  ModelRegistry().print_history()"

# Rollback a versión anterior
python scripts/model_rollback.py v1 "Reason: degradation"

# Demo completa (simula 3 ciclos)
python scripts/demo_model_registry.py
```

### Decisiones

```
Scoring Formula:
  combined_score = (rules × 0.4) + (ml × 0.4) + (learning × 0.2)

Ejecución:
  combined_score ≥ 0.70 → Execute + Monitor
  combined_score < 0.70 → Escalate (manual review)

Componentes:
  - Rules (0.4): Strategy confidence + guard validation
  - ML (0.4): ONNX model + enriched features
  - Learning (0.2): Strong/weak action feedback

Ejemplo:
  Rules = 0.80 (estrategia confidente)
  ML = 0.65 (modelo predice diferente)
  Learning = +0.10 (acción fuerte históricamente)
  
  Combined = (0.80 × 0.4) + (0.65 × 0.4) + ((0.10 + 0.10) × 0.2)
           = 0.32 + 0.26 + 0.04 = 0.62
  
  Result: 0.62 < 0.70 → Escalate para revisión
```

### Observabilidad

- **Logs**: `[COMBINED_SCORE]`, `[ESCALATE]`, `[ML_ACCURACY_RECORD]`
- **Métricas**: tasa aciertos ML vs rules en `learning.service`
- **Registry**: historial de versiones + deployments en `models/registry.json`
- **Reports**: recomendaciones en `models/reports/recommendation_vN.json`
- **Accuracy**: tracked por execution para mejora continua



## ML Validation & Production Readiness

## Estructura

```text
MetaBrain/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   ├── env.config.ts
│   │   └── ai.config.ts
│   ├── brain/
│   │   ├── brain.module.ts
│   │   ├── brain.service.ts
│   │   ├── brain.router.ts
│   │   └── strategies/
│   │       ├── booking.strategy.ts
│   │       ├── error.strategy.ts
│   │       └── schedule.strategy.ts
│   ├── guard/
│   │   ├── guard.module.ts
│   │   ├── guard.service.ts
│   │   ├── rules/
│   │   │   ├── booking.rules.ts
│   │   │   ├── data.rules.ts
│   │   │   └── safety.rules.ts
│   │   └── validators/
│   │       ├── booking.validator.ts
│   │       └── schedule.validator.ts
│   ├── action-engine/
│   │   ├── action.module.ts
│   │   ├── action.service.ts
│   │   └── executors/
│   │       ├── booking.executor.ts
│   │       ├── rollback.executor.ts
│   │       └── retry.executor.ts
│   ├── events/
│   │   ├── consumer/
│   │   │   ├── booking.consumer.ts
│   │   │   ├── error.consumer.ts
│   │   │   └── system.consumer.ts
│   │   ├── producer/
│   │   │   └── event.producer.ts
│   │   └── events.module.ts
│   ├── ai/
│   │   ├── ai.module.ts
│   │   ├── ai.service.ts
│   │   └── providers/
│   │       ├── groq.provider.ts
│   │       └── fallback.provider.ts
│   ├── memory/
│   │   ├── memory.module.ts
│   │   ├── memory.service.ts
│   │   └── schemas/
│   │       └── incidents.schema.ts
│   ├── audit/
│   │   ├── audit.module.ts
│   │   ├── audit.service.ts
│   │   └── audit.entity.ts
│   └── common/
│       ├── types/
│       │   └── brain.types.ts
│       ├── utils/
│       │   └── error-parser.util.ts
│       └── constants/
│           └── app.constants.ts
├── scripts/
│   └── start-dev.ps1
├── docker/
│   └── Dockerfile
├── .env
├── package.json
└── README.md
```

## Flujo implementado

1. `brain.service.ts` recibe incidente.
2. `guard.service.ts` normaliza y valida seguridad/datos.
3. `error-parser.util.ts` extrae fingerprint del error.
4. `brain.router.ts` decide estrategia (`booking`, `schedule`, `error`).
5. `action.service.ts` ejecuta reparación con executors.
6. `event.producer.ts` publica evento de acción ejecutada.
7. `memory.service.ts` persiste memoria operativa en memoria.
8. `audit.service.ts` registra auditoría.

## Uso en PowerShell

Instalación inicial:

```powershell
npm install
```

Desarrollo:

```powershell
.\scripts\start-dev.ps1
```

Build:

```powershell
npm run build
```

Run producción:

```powershell
npm run start
```

## Nota sobre "sin inventar"

La base creada es ejecutable y compilable, con servicios reales conectados entre sí (no solo archivos vacíos). Está lista para enchufar providers reales de IA, cola de eventos y persistencia de auditoría.
