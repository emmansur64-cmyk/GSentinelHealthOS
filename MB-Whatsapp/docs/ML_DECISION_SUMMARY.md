# RESUMEN EJECUTIVO: Arquitectura ML de MetaBrain

## Respuestas Directas a tus Preguntas

### 1️⃣ ¿Dónde está el LearningService y cómo funciona?

**Ubicación**: `src/learning/learning.service.ts` (147 líneas)

**Rol Principal**: Registra resultados de acciones ejecutadas y analiza su efectividad histórica.

**Flujo de Datos**:
```
IncidentPayload + BrainDecision + GatedExecutionResult
    ↓
LearningService.record(event, decision, executionResult)
    ↓
Resuelve outcome: ['success', 'failure', 'blocked', 'simulated']
    ↓
Append to outcomeLog[] (máx 500 registros)
    ↓
ActionEffectivenessAnalyzer.compute() con exponential decay (half-life 2h)
    ↓
Cálculos: successRate, failureRate, isWeak (>60% fallos + >3 muestras)
    ↓
Persistencia: data/outcomes.json (250ms debounce)
    ↓
(Opcionalmente) Cron daily a medianoche → retrainModel() Python scripts
```

**Métodos Clave**:

| Método | Entrada | Salida | Uso |
|--------|---------|--------|-----|
| `record()` | event, decision, executionResult | void | Post-execution (brain.service.ts:204) |
| `recordBlocked()` | action: CommandId | void | Cuando Decision Guard rechaza (brain.service.ts:166) |
| `getInsights()` | N/A | LearningInsights | **ACTUALMENTE NO USADO** ❌ |
| `retrainModel()` | N/A (Cron) | Promise | Evento automático cada medianoche |

**Dato crítico**: `getInsights()` retorna weak/strong actions del historial pero **NUNCA se pasa al decisor ML**.

---

### 2️⃣ ¿Cómo se usan actualmente las Reglas y Estrategias?

#### **REGLAS** (Input Guard - Nivel 1)
Ubicación: `src/guard/rules/`

```
GuardService.validate(input, eventType)
├── DataRules.evaluate()
│   └── ✓ required fields, message length
├── SafetyRules.evaluate()
│   └── ✓ SQL/Shell/PowerShell/Encoding injection patterns
└── BookingRules.evaluate()
    └── ✓ Booking events must have tenantId

Output: GuardVerdict { allowed, reasons[], normalizedInput }
If any rule fails → BLOCKED immediately
```

**Confianza**: Binaria (allowed/blocked) - No hay score gradual.

#### **ESTRATEGIAS** (Decision Logic - Nivel 2)
Ubicación: `src/brain/strategies/`

**Flujo de selección**:
```
BrainRouter.route(fingerprint: ErrorFingerprint)
├── if category === 'booking' → BookingStrategy
├── if category === 'schedule' → ScheduleStrategy
└── else → ErrorStrategy (default para en 100% de casos)

Strategy retorna: BrainDecision {
  action,
  confidence: 0.55-0.92 (hardcoded por estrategia)
}
```

**Estrategias**:

| Estrategia | Acción | Confidence | Condición |
|-----------|--------|-----------|-----------|
| **ErrorStrategy** | `restart_postgres` | 0.82 | fingerprint.code === 'DB_CONNECTION_TIMEOUT' |
| | `retry_with_backoff` | 0.84 | fingerprint.code === 'TRANSIENT_SYSTEM_ERROR' |
| | `retry_with_backoff` | 0.55 | default fallback |
| **BookingStrategy** | `reconcile_booking_slots` | 0.92 | Always |
| **ScheduleStrategy** | `normalize_schedule_window` | 0.88 | Always |

**Problema**: Las estrategias tienen confianza **fija per-tipo**, no adaptativa.

---

### 3️⃣ ¿Dónde está el fallback a Reglas + Flujo Actual?

#### **NO Hay Fallback a Reglas en la lógica actual**

Hay 3 niveles de decisión:

```
NIVEL 1: Input Guard (GuardService.validate)
  if rejected → BLOCKED (exit)
  if passed → proceed

NIVEL 2: Strategy Selection (Router + Strategy.decide)
  Always succeeds → BrainDecision con confidence 0.55-0.92

NIVEL 3: ML vs Rules Comparison (🔴 PROBLEMA AQUÍ)
  mlResult.confidence (1.0 hardcoded)
  >
  decision.confidence (0.55-0.92)

  RESULTADO: ML casi siempre GANA
  └─ Reglas se ignoran en la mayoría de casos
```

#### **El Único Fallback Verdadero**:
```typescript
// brain.service.ts:216-225
catch (error) {
  // Si CUALQUIER COSA falla:
  // - Execution fue excepcional
  // - Parsing error
  // - Network timeout

  return {
    status: 'FALLBACK',
    action: decision?.action ?? '',  // Usa lo que tengamos
    execution: null,
  };
}
```

**No es fallback a reglas, es usar el último decision object en memoria.**

---

### 4️⃣ ¿Cómo se toma la Decisión Final?

#### **Árbol de Decisión Completo** (7 gates secuenciales)

```
Input
  ↓ [GATE 1: Rate Limit]
  checkRateLimit() — if (incidentTimestamps.length >= 5/sec) → BLOCKED
  ↓ [GATE 2: Input Guard]
  GuardService.validate() — DataRules, SafetyRules, BookingRules
  if rejected → BLOCKED + LearningService.recordBlocked()
  ↓ [GATE 3: Strategy Route]
  BrainRouter.route() → 'booking'|'schedule'|'error'
  ErrorStrategy.decide() [or Booking/Schedule variants]
  ↓ [GATE 4: ⚠️ ML vs RULES COMPARISON]
  if (mlResult.confidence > decision.confidence) {
    finalDecision = mlAction  // "ML WINS"
  } else {
    finalDecision = rulesAction  // "RULES WIN"
  }
  🔴 PROBLEMA: mlResult.confidence = 1.0 siempre → ML CASI SIEMPRE GANA
  ↓ [GATE 5: Decision Guard]
  GuardService.validateDecision()
    - confidence >= 0.7?
    - command registered?
    - command enabled?
    - risk != 'high'?
  if fails → BLOCKED + recordBlocked()
  ↓ [GATE 6: AI Enrichment]
  AiService.suggestEnhancement() → append hint to reason
  ↓ [GATE 7: Execution]
  ActionService.execute() → ExecutionService.gate()
  ↓ [GATE 8: Learning Record]
  LearningService.record(event, decision, executionResult)
    outcome = 'success'|'failure'|'blocked'|'simulated'
    persist to data/outcomes.json
  ↓
Output: IncidentResult
```

#### **Variables de Control en brain.service.ts**

```typescript
// Lines 73-150
const normalizedInput = guardVerdict.normalizedInput;  // After guard pass
const fingerprint = extractErrorFingerprint(normalizedInput);
const enrichedDiagnosis = systemBrainService.process(fingerprint, normalizedInput);
const route = router.route(fingerprint);

// Strategy decision
let decision = errorStrategy.decide(input, fingerprint);
if (route === 'booking') decision = bookingStrategy.decide(input, fingerprint);
if (route === 'schedule') decision = scheduleStrategy.decide(input, fingerprint);
// At this point: confidence = 0.55-0.92

// ML hybrid
const mlResult = await modelService.predictDecision(hourOfDay, dayOfWeek);
// mlResult.confidence = 1.0 (hardcoded) ← 🔴 PROBLEMA
const rulesConfidence = decision.confidence;

let finalDecision = decision;
if (mlResult.action && mlResult.confidence > rulesConfidence) {
  // ← 99% de probabilidad ML > Rules (1.0 > anything)
  finalDecision = { ...decision, action: mlResult.action };
}

// Decision guard
const decisionVerdict = guardService.validateDecision(finalDecision);
if (!decisionVerdict.allowed) {
  // recordBlocked() → LearningService.recordBlocked(action)
  return { status: 'BLOCKED', ... };
}

// Action execution
const action = actionService.execute(finalDecision);
const executionResult = await executionService.gate(action, finalDecision);

// Learning feedback
learningService?.record(normalizedInput, finalDecision, executionResult);
```

---

## 🔴 Problemas Identificados con Scoring Actual

### Problema 1: ML Hardcoded a 1.0
```typescript
// predictor.ts:21
const confidence = 1.0; // Placeholder
```
Resultado: **ML SIEMPRE GANA contra Rules (1.0 > 0.55-0.92)**

### Problema 2: Learning Service Disconnected
```typescript
// getInsights() nunca se llama en el decisor
const insights = this.learningService?.getInsights();
// weakActions, strongActions, actionStats → IGNORADOS
```

### Problema 3: Features Insuficientes
```typescript
// model.service.ts:6
const features = [hourOfDay, dayOfWeek, 0, 0, 0, 0]; // Solo 2 de 6
```
Falta: acción actual, patrones, efectividad histórica, contexto.

### Problema 4: Espacio de Acciones Reducido
```typescript
// predictor.ts:20
const actions = ['retry_with_backoff']; // Una sola acción
```

### Problema 5: Sin Ensembling
```typescript
// Decisión binaria
if (mlScore > ruleScore) → ML
else → Rules
```
No hay weighted combination, voting, confidence intervals.

---

## ✅ Puntos Exactos para Aplicar Scoring Combinado

### Punto 1: Enriquecimiento de Features
**Ubicación**: brain.service.ts línea 142 (antes de predictDecision)

```typescript
// Agregar:
const insights = this.learningService.getInsights();
const enrichedFeatures = [
  hourOfDay,
  dayOfWeek,
  insights.strongActions.includes(decision.action) ? 1 : 0,
  insights.weakActions.includes(decision.action) ? 1 : 0,
  decision.confidence,
  enrichedDiagnosis.actionRiskScore,
];

const mlResult = await this.modelService.predictDecision(
  enrichedFeatures,
  decision.action,  // Current candidate
  fingerprint.code
);
```

### Punto 2: Scoring Combinado
**Ubicación**: brain.service.ts línea 149-150 (ML vs Rules comparison)

```typescript
// ACTUAL:
if (mlResult.confidence > rulesConfidence) {
  finalDecision = { ...decision, action: mlResult.action };
}

// PROPUESTA:
const combinedScore = {
  rules: rulesConfidence,           // 0.55-0.92
  ml: mlResult.confidence,          // 0-1.0 (real)
  learning: insights.weakActions.includes(mlResult.action) ? -0.2 :
            insights.strongActions.includes(mlResult.action) ? 0.1 : 0,
  ensemble: (rulesConfidence + mlResult.confidence + learningBoost) / 3,
};

if (combinedScore.ensemble > 0.7) {
  const winner = highest([
    mlResult.action @ combinedScore.ml,
    decision.action @ combinedScore.rules
  ]);
  finalDecision = { ...decision, action: winner };
}
```

### Punto 3: Feedback Loop de ML Accuracy
**Ubicación**: brain.service.ts línea 204-205 (después de execution)

```typescript
// ACTUAL:
this.learningService?.record(normalizedInput, decision, executionResult);

// AGREGAR:
const mlAccuracy = {
  mlPredicted: mlResult.action,
  mlConfidence: mlResult.confidence,
  actualAction: decision.action,
  actualOutcome: executionResult.executed ? 'success' : 'failure',
  mlWasCorrect: mlResult.action === decision.action && executionResult.executed,
};
// Persistir para análisis de ML effectiveness
```

---

## Tablas de Referencia Rápida

### Métodos de LearningService
```
record(event, decision, executionResult)
  Registra outcome y persiste

recordBlocked(action)
  Registra acción rechazada

getInsights()
  ↓ LearningInsights { weakActions[], strongActions[], actionStats }
  ❌ NUNCA USADO en decisor

retrainModel() @Cron(EVERY_DAY_AT_MIDNIGHT)
  Ejecuta Python ML pipeline
```

### Métodos de GuardService
```
validate(input, eventType?)
  ↓ GuardVerdict { allowed, reasons[], normalizedInput }
  Runs: DataRules, SafetyRules, BookingRules

validateDecision(decision)
  ↓ { allowed, reasons[] }
  Checks: confidence, registration, enabled, risk
```

### Métodos de Estrategias
```
ErrorStrategy.decide(input, fingerprint)
  ↓ BrainDecision { action, confidence: 0.55-0.84 }

BookingStrategy.decide(input, fingerprint)
  ↓ BrainDecision { action: 'reconcile_booking_slots', confidence: 0.92 }

ScheduleStrategy.decide(input, fingerprint)
  ↓ BrainDecision { action: 'normalize_schedule_window', confidence: 0.88 }
```

### Métodos de ModelService
```
predictDecision(hourOfDay, dayOfWeek)
  INPUT: 2 parámetros (⚠️ debería ser 6+ features enriquecidas)
  OUTPUT: { action, confidence: 1.0 }
  ❌ Hardcoded confidence y acción limitada
```

---

## Conclusión

**El sistema actual tiene los 3 componentes**:
1. ✅ **Reglas**: Funcionan bien (guards + estrategias)
2. ✅ **ML**: Infraestructura lista (ONNX + predictor)
3. ✅ **Learning**: Registra y analiza (outcomes + effectiveness)

**Pero están DESCONECTADOS**:
- ML ignora Learning insights
- Learning nunca alimenta al ML
- No hay ensemble real (simple XOR)
- Scoring hardcoded hace que ML siempre gane

**Oportunidad**: Interconectar los 3 en `brain.service.ts` líneas 142-150 con scoring combinado normalizado y feedback loop.
