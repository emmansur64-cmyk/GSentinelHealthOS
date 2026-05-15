# Análisis Profundo de Arquitectura ML - MetaBrain

## 1. LearningService: Dónde está y cómo funciona

### Ubicación
**Archivo principal**: [src/learning/learning.service.ts](../src/learning/learning.service.ts)

**Responsabilidades**:
- Registrar resultados de acciones ejecutadas
- Analizar efectividad de acciones con decaimiento temporal
- Computar insights sobre acciones débiles/fuertes
- Entrenar modelo ML diariamente (cron job)

### Arquitectura Interna

```
LearningService
├── outcomeLog: OutcomeRecord[] (máx 500 registros)
│   └── OutcomeRecord { action, outcome: 'success'|'failure'|'blocked'|'simulated', recordedAt }
├── ActionEffectivenessAnalyzer
│   └── compute(records) → ActionEffectiveness[]
│       ├── Agrupa por action
│       ├── Aplica weight = exp(-ageMs / 2h)  [decaimiento exponencial]
│       ├── Calcula: successRate, failureRate, isWeak
│       └── isWeak: failureRate > 60% AND total > 3 muestras
├── Persistencia: data/outcomes.json (debounce 250ms)
├── Persistencia DB: N/A actualmente
└── Cron: retrainModel() cada medianoche
```

### Métodos Clave

#### `record(event: IncidentPayload, decision: BrainDecision, executionResult: GatedExecutionResult | null)`
```typescript
// Brain.service.ts:204 - Called after execution
this.learningService?.record(normalizedInput, decision, executionResult);

// Resolves outcome based on execution
private resolveOutcome(result: GatedExecutionResult | null):
  | 'success'     // result.executed && !result.simulated
  | 'failure'     // result === null || (!result.executed && !result.simulated)
  | 'simulated'   // result.simulated
  | 'blocked'     // recordBlocked() method
```

#### `recordBlocked(action: CommandId)`
```typescript
// Called when Decision Guard rejects decision
this.learningService?.recordBlocked(decision.action);
// Records { action, outcome: 'blocked' }
```

#### `getInsights(): LearningInsights`
```typescript
interface LearningInsights {
  weakActions: CommandId[];      // failureRate > 60% && total > 3
  strongActions: CommandId[];    // !isWeak && successRate >= 70%
  actionStats: {                 // Detailed per-action metrics
    [action]: {
      successRate: number;       // weighted success %
      failureRate: number;       // weighted failure %
      total: number;             // unweighted count
    }
  }
}
```

#### `retrainModel() @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)`
```typescript
// Executes at 00:00 UTC daily
// Shell: python scripts/data_pipeline.py && python scripts/train_model.py
// Retrains ONNX model on historical outcomes
```

### Análisis de Decaimiento Temporal

```
Weight Function: w = exp(-age_ms / 2_hours)

Ejemplos:
- 0 horas atrás:   w = 1.0    (peso 100%)
- 1 hora atrás:    w ≈ 0.707  (peso 70.7%)
- 2 horas atrás:   w ≈ 0.368  (peso 36.8%)  ← half-life
- 4 horas atrás:   w ≈ 0.135  (peso 13.5%)
- 6 horas atrás:   w ≈ 0.050  (peso 5%)

Implicación: Acciones recientes pesan mucho más que los historiales antiguos.
```

---

## 2. Cómo se usan actualmente las Reglas y Estrategias

### Ubicación de Reglas
`src/guard/rules/` contiene validación de entrada:

#### **DataRules** (data.rules.ts)
```typescript
evaluate(input: IncidentPayload): string[] {
  // Rechaza si:
  // - Faltan campos requeridos: id, message, source, timestamp
  // - message.length < 5

  return reasons;  // [] si pasa, ['required_fields_missing', ...] si falla
}
```

#### **SafetyRules** (safety.rules.ts)
```typescript
evaluate(input: IncidentPayload): string[] {
  // Evalúa 6 categorías de inyección usando regex:
  // 1. sql_injection: DROP TABLE, DELETE FROM, UNION SELECT, etc.
  // 2. shell_injection: rm -rf, del /f, mkfs, etc.
  // 3. command_chaining: &&, ||, ;, backticks, $()
  // 4. powershell_execution: Invoke-Expression, Add-Type, etc.
  // 5. network_exfiltration: curl, wget, ncat, nmap
  // 6. encoding_obfuscation: base64, charCodeAt, \x escapes

  // Si encuentra match → return ['unsafe_payload_detected:{category}']
}
```

#### **BookingRules** (booking.rules.ts)
```typescript
evaluate(input: IncidentPayload): string[] {
  // Rechaza si:
  // - source.toLowerCase().includes('booking') && !metadata.tenantId

  return reasons;
}
```

### Ubicación y Uso de Estrategias
`src/brain/strategies/` contiene decisión de acción por tipo de incidente:

#### **ErrorStrategy** (error.strategy.ts)
```typescript
decide(input: IncidentPayload, fingerprint: ErrorFingerprint): BrainDecision {
  if (fingerprint.code === 'DB_CONNECTION_TIMEOUT') {
    return {
      strategy: 'error',
      action: 'restart_postgres',
      confidence: 0.82,
      reason: `Fallback para error ${fingerprint.code} en ${input.source}`
    }
  }

  if (fingerprint.code === 'TRANSIENT_SYSTEM_ERROR') {
    confidence = 0.84;
  } else {
    confidence = 0.55;  // Bajo por defecto
  }

  return {
    action: 'retry_with_backoff',
    confidence,
    reason: `...`
  }
}
```

**Decisiones de ErrorStrategy**:
- `restart_postgres` (confidence: 0.82) para `DB_CONNECTION_TIMEOUT`
- `retry_with_backoff` (confidence: 0.84) para `TRANSIENT_SYSTEM_ERROR`
- `retry_with_backoff` (confidence: 0.55) para otros errores

#### **BookingStrategy** (booking.strategy.ts)
```typescript
decide(input: IncidentPayload, fingerprint: ErrorFingerprint): BrainDecision {
  return {
    strategy: 'booking',
    action: 'reconcile_booking_slots',
    confidence: 0.92,
    reason: `${fingerprint.summary} para ${input.source}`
  }
}
```

**Decisión fija**: `reconcile_booking_slots` con confidence 0.92

#### **ScheduleStrategy** (schedule.strategy.ts)
```typescript
decide(input: IncidentPayload, fingerprint: ErrorFingerprint): BrainDecision {
  return {
    strategy: 'schedule',
    action: 'normalize_schedule_window',
    confidence: 0.88,
    reason: `${fingerprint.summary} en flujo ${input.source}`
  }
}
```

**Decisión fija**: `normalize_schedule_window` con confidence 0.88

### Flujo de Selección de Reglas/Estrategias

```
BrainRouter.route(fingerprint: ErrorFingerprint)
├── if category === 'booking' → 'booking' route
├── if category === 'schedule' → 'schedule' route
└── else → 'error' route (default)

DESPUÉS en brain.service.ts:analyze()
├── decision = ErrorStrategy.decide()  // Default for all
├── if route === 'booking' → decision = BookingStrategy.decide()
├── if route === 'schedule' → decision = ScheduleStrategy.decide()
└── return decision
```

**Ubicación**: BrainRouter en [src/brain/brain.router.ts](../src/brain/brain.router.ts)

---

## 3. Flujo de Fallback a Reglas: Arquitectura Actual

### Flujo Completo de Decisión

```
PHASE 1: Input Guard
  GuardService.validate(input, eventType)
  ├── DataRules.evaluate(input)
  ├── SafetyRules.evaluate(input)
  ├── BookingRules.evaluate(input) [solo si booking event]
  └── if any rule fails → BLOCKED
      └── LearningService.recordBlocked(action) [NUNCA ALCANZADO]

PHASE 2: Fingerprint + Strategy
  errorFingerprint = extractErrorFingerprint(normalizedInput)
  route = BrainRouter.route(fingerprint)
  diagnosis = SystemBrainService.process(fingerprint, input)

  decision = ErrorStrategy.decide(input, fingerprint)
  if route === 'booking':
    decision = BookingStrategy.decide(input, fingerprint)
  if route === 'schedule':
    decision = ScheduleStrategy.decide(input, fingerprint)

  decision.confidence = 0.55 to 0.92 (strategy-dependent)

PHASE 3: ML Hybrid Decision *** KEY POINT ***
  mlResult = ModelService.predictDecision(hourOfDay, dayOfWeek)
  rulesConfidence = decision.confidence

  IF mlResult.confidence > rulesConfidence:
    finalDecision = ML action  // "ML WINS"
  ELSE:
    finalDecision = Rules action  // "RULES WIN"

  ⚠️ PROBLEMA:
    - mlResult.confidence es HARDCODED a 1.0
    - Casi siempre ML WINS (1.0 > 0.55-0.92)
    - LearningService.getInsights() NUNCA se usa aquí

PHASE 4: Decision Guard
  GuardService.validateDecision(decision)
  ├── if confidence < 0.7 → BLOCKED
  ├── if command not registered → BLOCKED
  ├── if command disabled → BLOCKED
  ├── if command.risk === 'high' → BLOCKED
  └── else → PASS

PHASE 5: AI Enhancement
  aiHint = AiService.suggestEnhancement(input, decision)
  decision.reason += `. AI: ${aiHint}`

PHASE 6: Execution
  action = ActionService.execute(decision)
  executionResult = ExecutionService.gate(action, decision)

  *** LEARNING RECORDING ***
  LearningService.record(input, decision, executionResult)
  ├── outcome = 'success' | 'failure' | 'blocked' | 'simulated'
  ├── append to outcomeLog
  └── persistAsync() → data/outcomes.json (250ms debounce)
```

### El Verdadero FALLBACK: cuando todo falla

```typescript
// brain.service.ts:216-225
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  this.logger.error(`[FALLBACK] ${normalizedInput.id ?? input.id} — ${message}`);
  this.auditSafe(..., 'FAILED', null, message);

  return {
    status: 'FALLBACK',
    action: decision?.action ?? '',  // Whatever we had
    reason: message,
    execution: null,
  };
}
```

**El fallback no es a las reglas, es a cualquier decision parcial que tengamos en memoria.**

---

## 4. Decisión Final: Cómo se elige la acción

### Árbol de Decisión Completo

```
Input IncidentPayload
  ↓
[1] checkRateLimit()
  if (incidentTimestamps.length >= 5/sec) → BLOCKED

[2] guardService.validate(input, eventType)
  Runs: DataRules, SafetyRules, BookingRules
  if (reasons.length > 0) → BLOCKED
  output: normalizedInput

[3] extractErrorFingerprint(normalizedInput)
  Parses: code, category, summary, context

[4] systemBrainService.process(fingerprint, input)
  if (!systemBrainService) → buildDefaultEnrichedDiagnosis()
  output: EnrichedDiagnosis {
    recentFailures, repeatDetected, shouldThrottle,
    shouldBlockAction, pattern, weakActions, strongActions
  }

[5] BrainRouter.route(fingerprint)
  output: 'booking' | 'schedule' | 'error'

[6] Strategy Decision
  if route === 'booking':
    decision = BookingStrategy.decide()
  elif route === 'schedule':
    decision = ScheduleStrategy.decide()
  else:
    decision = ErrorStrategy.decide()
  output: BrainDecision {
    strategy, action, confidence, reason
  }

[7] Apply SystemBrain safety (applySystemBrainDecisionSafety)
  Modifies decision based on enrichedDiagnosis

[8] *** ML vs Rules Comparison ***
  mlResult = await modelService.predictDecision(hourOfDay, dayOfWeek)

  IF (mlResult.action && mlResult.confidence > decision.confidence):
    finalDecision.action = mlResult.action
    finalDecision.reason = `ML override: ${decision.reason}`
  ELSE:
    finalDecision = decision  // Rules win

  ⚠️ CURRENT PROBLEM:
     mlResult.confidence = 1.0 (hardcoded)
     decision.confidence = 0.55-0.92 (from strategy)
     → ML ALMOST ALWAYS WINS

[9] guardService.validateDecision(finalDecision)
  Checks:
  - confidence >= 0.7
  - command in SAFE_COMMANDS registry
  - command.enabled === true
  - command.risk !== 'high'

  if invalid → BLOCKED + recordBlocked(action)

[10] aiService.suggestEnhancement(input, finalDecision)
  Appends AI hint to decision.reason

[11] ActionService.execute(finalDecision)
  Converts BrainDecision → ActionEnvelope { command, params, ... }

[12] ExecutionService.gate(action, finalDecision)
  Executes or simulates action
  Returns: GatedExecutionResult { executed, simulated, output, error, reason }

[13] LearningService.record(input, finalDecision, executionResult)
  Records outcome: success | failure | blocked | simulated
  Persists to data/outcomes.json

[14] Return IncidentResult to caller
```

### Variables de Decisión en Brain.service.ts

| Variable | Línea | Tipo | Origen |
|----------|-------|------|--------|
| `normalizedInput` | 73 | IncidentPayload | GuardService.validate() |
| `fingerprint` | 98 | ErrorFingerprint | extractErrorFingerprint() |
| `decision` | 130-135 | BrainDecision | ErrorStrategy/Booking/Schedule |
| `mlResult` | 142 | { action, confidence } | ModelService.predictDecision() |
| `finalDecision` | 150 | BrainDecision | ML > Rules comparison |
| `decisionVerdict` | 153 | GuardVerdict | guardService.validateDecision() |
| `action` | 176 | ActionEnvelope | ActionService.execute() |
| `executionResult` | 179 | GatedExecutionResult | ExecutionService.gate() |

---

## 5. Problemas Identificados para Scoring Combinado

### 5.1 El ML está deshabilitado de hecho

**Código actual** (brain.service.ts:142-149):
```typescript
const mlResult = await this.modelService.predictDecision(hourOfDay, dayOfWeek);
const rulesConfidence = decision.confidence;  // 0.55-0.92

let finalDecision = decision;
if (mlResult.action && mlResult.confidence > rulesConfidence) {
  // ML: confidence = 1.0 (hardcoded)
  // Rules: confidence ≤ 0.92
  // → ALWAYS TRUE · ML ALWAYS WINS
  finalDecision = { ...decision, action: mlResult.action};
}
```

**Problema**: `Predictor.predict()` devuelve hardcoded `confidence: 1.0`
- No hay incertidumbre real
- ML siempre supera a rules (1.0 > cualquier cosa)
- Reglas del brain.router nunca tienen impacto

### 5.2 ML no tiene contexto de efectividad histórica

**Nunca se pasa**:
```typescript
// LearningService.getInsights() está disponible pero NO SE USA
const insights = this.learningService?.getInsights();
// insights.weakActions, insights.strongActions IGNORADOS

// Debería fluir a ModelService o decision logic
```

### 5.3 Características ML insuficientes

**Código** (model.service.ts:6):
```typescript
const features = [hourOfDay, dayOfWeek, 0, 0, 0, 0]; // Solo 2 de 6!
```

**Falta**:
- Outcome histórico de acciones
- Patrones recientes
- Contexto de incidente (categoría, severidad)
- Métricas de SystemBrain

### 5.4 Espacio de acciones reducido

**Código** (predictor.ts:21):
```typescript
const actions = ['retry_with_backoff'];  // Hardcoded a 1 acción
const action = actions[predIndex] || 'retry_with_backoff';
```

**Debería**: Soportar ['retry_with_backoff', 'reconcile_booking_slots', 'normalize_schedule_window', 'restart_postgres']

### 5.5 No hay ensembling de scores

**Decisión actual**: Simple `if (ml > rules)` → boolean XOR
**Debería ser**: Weighted average o voting:
- Rules confidence: 0.55-0.92 (domain-specific)
- ML confidence: 0-1.0 (statistical)
- Learning effectiveness: weak/strong/unknown
- AI suggestion: optional boost

---

## 6. Puntos de Aplicación para Scoring Combinado

### 6.1 **Enriquecimiento de Características ML**

**Actual**:
```typescript
const features = [hourOfDay, dayOfWeek, 0, 0, 0, 0];
```

**Propuesta**:
```typescript
// En brain.service.ts antes de predictDecision()
const insights = this.learningService.getInsights();
const features = [
  // Temporal
  hourOfDay,
  dayOfWeek,
  // Action effectiveness
  insights.strongActions.includes(decision.action) ? 1 : 0,
  insights.weakActions.includes(decision.action) ? 1 : 0,
  // Confidence baseline
  decision.confidence,
  // SystemBrain enrichment
  enrichedDiagnosis.actionRiskScore,
];

// Luego pase features + decision context al ML
const mlResult = await this.modelService.predictDecision(
  features,
  decision.action,  // Current candidate
  fingerprintCode
);
```

### 6.2 **Ensemble de Scoring en Decision Guard**

**Actual**:
```typescript
if (mlResult.confidence > rulesConfidence) {
  finalDecision = mlAction;
}
```

**Propuesta**:
```typescript
// Calcula score combinado
const ruleScore = decision.confidence;
const mlScore = mlResult.confidence;
const learningBoost = insights.strongActions.includes(mlResult.action)
  ? 0.1 : insights.weakActions.includes(mlResult.action)
  ? -0.1 : 0;

const combinedScore = {
  action: mlResult.action,
  ruleScore,
  mlScore,
  learningBoost,
  finalScore: (ruleScore + mlScore + learningBoost) / 3,
  components: { ruleScore, mlScore, learningBoost }
};

if (combinedScore.finalScore > 0.7) {
  finalDecision = combinedScore.action;
}
```

### 6.3 **Loop de Feedback: Validación de Predicción**

**Ubicación**: brain.service.ts line 204-205
```typescript
// DESPUÉS de execution
this.learningService?.record(normalizedInput, decision, executionResult);

// PROPUESTA: Registrar también predicción ML
const mlAccuracy = {
  mlAction: mlResult.action,
  mlConfidence: mlResult.confidence,
  actualOutcome: executionResult.executed ? 'success' : 'failure',
  mlWasCorrect: false  // A computar
};
```

### 6.4 **Estrategia Multiacciones del ML**

**Actual**: Predictor solo soporta 'retry_with_backoff'

**Propuesta**:
```typescript
// En predictor.ts
const SUPPORTED_ACTIONS = [
  'retry_with_backoff',
  'reconcile_booking_slots',
  'normalize_schedule_window',
  'restart_postgres',
  'escalate_to_human',
];

// Luego retornar top-3
return {
  action: SUPPORTED_ACTIONS[predIndex],  // Best
  alternatives: [
    SUPPORTED_ACTIONS[topK[1]],
    SUPPORTED_ACTIONS[topK[2]],
  ],
  confidence: Math.max(...data),  // Real confidence, not 1.0
};
```

### 6.5 **Matriz de Decisión Multi-Factor**

**Ubicación para insertar**: Antes de line 150 en brain.service.ts

```typescript
// Construir matriz de evaluación
const decisionMatrix = {
  rules: {
    action: decision.action,
    score: decision.confidence,
    source: 'ErrorStrategy|BookingStrategy|ScheduleStrategy',
  },
  ml: {
    action: mlResult.action,
    score: mlResult.confidence,
    source: 'ModelService.predictDecision()',
  },
  learning: {
    action: insights.strongActions[0] || decision.action,
    score: insights.weakActions.includes(decision.action) ? -0.2 : 0.1,
    source: 'LearningService.getInsights()',
  },
  systemBrain: {
    blockSuggestion: enrichedDiagnosis.shouldBlockAction,
    throttleSuggestion: enrichedDiagnosis.shouldThrottle,
    riskScore: enrichedDiagnosis.actionRiskScore,
  },
};

// Finales decision = normalize(decisionMatrix)
const finalDecision = selectBestAction(decisionMatrix);
```

---

## 7. Resumen de Métodos Clave

### Métodos del Learning Service

| Método | Firma | Propósito |
|--------|-------|----------|
| `record()` | `(event, decision, executionResult) → void` | Registra outcome de acción |
| `recordBlocked()` | `(action) → void` | Registra acción bloqueada |
| `getInsights()` | `() → LearningInsights` | Retorna weak/strong actions |
| `retrainModel()` | `@Cron() → Promise` | Entrena ONNX diariamente |
| `append()` | `(record) → void` | Agrega a outcomeLog + persiste |

### Métodos de Reglas y Estrategias

| Método | Clase | Entrada | Salida |
|--------|-------|---------|--------|
| `evaluate()` | DataRules | IncidentPayload | string[] (razones rechazo) |
| `evaluate()` | SafetyRules | IncidentPayload | string[] (razones rechazo) |
| `evaluate()` | BookingRules | IncidentPayload | string[] (razones rechazo) |
| `decide()` | ErrorStrategy | (input, fingerprint) | BrainDecision |
| `decide()` | BookingStrategy | (input, fingerprint) | BrainDecision |
| `decide()` | ScheduleStrategy | (input, fingerprint) | BrainDecision |
| `route()` | BrainRouter | ErrorFingerprint | 'booking'\|'schedule'\|'error' |

### Métodos de Decision Guard

| Método | Clase | Entrada | Salida |
|--------|-------|---------|--------|
| `validate()` | GuardService | (input, eventType?) | GuardVerdict |
| `validateDecision()` | GuardService | BrainDecision | {allowed, reasons} |

---

## 8. Oportunidades de Mejora Identificadas

1. **✅ Desbloquear Learning en decisiones**: Pasar `getInsights()` al decisor
2. **✅ Normalizar confidencias**: Usar escala 0-1 consistente
3. **✅ Expandir features ML**: Temporal + efectividad + contexto
4. **✅ Soportar múltiples acciones**: ML retorna top-3 candidatos
5. **✅ Feedback loop**: Registrar precisión ML vs reglas
6. **✅ Ensembling**: Weighted combination en lugar de XOR
7. **✅ Traceability**: Auditar qué componente decidió en cada fase

---

## Referencias de Código

**Archivos Analizados**:
- [src/learning/learning.service.ts](../src/learning/learning.service.ts) - Registro y análisis de outcomes
- [src/brain/brain.service.ts](../src/brain/brain.service.ts) - Orquestación principal (líneas 142-149 decisión ML)
- [src/brain/brain.router.ts](../src/brain/brain.router.ts) - Enrutamiento por categoría
- [src/brain/strategies/*.ts](../src/brain/strategies/) - ErrorStrategy, BookingStrategy, ScheduleStrategy
- [src/guard/guard.service.ts](../src/guard/guard.service.ts) - Input y decision validation
- [src/guard/rules/*.ts](../src/guard/rules/) - DataRules, SafetyRules, BookingRules
- [src/ml/model.service.ts](../src/ml/model.service.ts) - Predicción ML
- [src/ml/predictor.ts](../src/ml/predictor.ts) - Inferencia ONNX
- [src/learning/analyzers/action-effectiveness.analyzer.ts](../src/learning/analyzers/action-effectiveness.analyzer.ts) - Análisis con decaimiento
