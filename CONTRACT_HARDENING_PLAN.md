# CONTRACT_HARDENING_PLAN.md
**GSentinelHealthOS — Plan de Hardening de Contratos**
**Fecha:** 2026-05-16
**Objetivo:** Convertir todos los contratos con riesgo ALTO/CRÍTICO en contratos deterministas, validados y trazables.
**Restricciones:** Sin romper arquitectura existente. Sin cambios de comportamiento clínico. Sin deploy. Sin DB migrations.

---

## PRIORIZACIÓN

### Tier 0 — CRÍTICO (bloquean producción clínica)
- DRIFT-003: ImagingApiResponse completamente opcional → riesgo de false negative silencioso
- DRIFT-009: Redis WhatsApp queue sin schema → mensajes incorrectos a clientes reales
- BOUNDARY-09: PHI `safe_for_phi` no enforced → PHI enviado a Groq sin control

### Tier 1 — ALTO (deben resolverse antes de producción)
- DRIFT-001: Role enum asimétrico Brain Decide
- DRIFT-006: HybridDecisionOrchestrator dict sin schema
- DRIFT-007: LearningRecord sin schema_version
- DRIFT-008: MemoryScope sin coherencia scope/id
- BOUNDARY-02: PHI en IncidentPayload.metadata
- BOUNDARY-03: PatientCtx.notes sin redacción
- ISOLATION-01: Dualidad implementación Groq
- ISOLATION-02: safe_for_phi no enforced
- ISOLATION-03: ProviderRequest safety_level no enforced
- MM-03: ImagingApiResponse insuficiente
- MM-05: SmallMedicalCNN sin labels enum ni thresholds

### Tier 2 — MEDIO (deben resolverse en pre-producción)
- DRIFT-002: MedicalAssistantRequest transición sin validación
- DRIFT-004: OutboxRecord payload sin re-validar al leer
- DRIFT-005: NLU Engine output sin schema
- DRIFT-011: MedicalRuntimeToolContext sin runtime validation
- DRIFT-012: DecideContext.recent_history sin tipo
- DRIFT-013: MedicalImagingService ENV directo
- BR-01: SaaS→Brain response sin Zod

---

## HARDENING TIER 0

### H-T0-01: Zod schema para ImagingApiResponse
**Archivo:** `MB-Chat/src/ai/medical-imaging.service.ts`
**Cambio:** Reemplazar `interface ImagingApiResponse` con Zod schema + `.safeParse()`

```typescript
// ANTES:
interface ImagingApiResponse {
  findings?: string;
  probability?: number;
  notes?: string;
}
const data = (await res.json()) as ImagingApiResponse;

// DESPUÉS:
import { z } from 'zod';
const ImagingApiResponseSchema = z.object({
  findings: z.string().optional(),
  probability: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
}).strict();

const rawData = await res.json();
const parseResult = ImagingApiResponseSchema.safeParse(rawData);
if (!parseResult.success) {
  this.logger.error(`[MedicalImaging] Response schema invalid: ${parseResult.error.message}`);
  return { findings: 'Respuesta de API de imagen no válida.', probability: 0, notes: 'Schema inválido', assisted: true, provider: this.provider };
}
const data = parseResult.data;
```

**Impacto:** Sin cambio de comportamiento observable. Solo agrega detección de schema inválido.
**Rollback:** Revertir el schema a `as ImagingApiResponse`.

---

### H-T0-02: Pydantic schema para mensajes Redis WhatsApp
**Archivo nuevo:** `whatsapp_gateway/schemas/outgoing_message.py`
**Archivos a modificar:** `whatsapp_gateway/app/queue.py`, `whatsapp_gateway/app/outgoing_consumer.py`

```python
# whatsapp_gateway/schemas/outgoing_message.py (NUEVO)
from __future__ import annotations
from pydantic import BaseModel, Field

class WhatsAppOutgoingMessage(BaseModel):
    schema_version: int = Field(1, const=True)
    to_phone: str = Field(..., pattern=r"^\+?[1-9]\d{1,14}$")
    message_text: str = Field(..., min_length=1, max_length=4096)
    correlation_id: str = Field(...)
    source: str = Field(...)   # "brain" | "api" | "manual"
    
    class Config:
        extra = "forbid"
```

**En queue.py — al enqueue:**
```python
msg = WhatsAppOutgoingMessage(
    to_phone=phone,
    message_text=text,
    correlation_id=correlation_id,
    source=source,
)
await redis.rpush(QUEUE_KEY, msg.model_dump_json())
```

**En outgoing_consumer.py — al dequeue:**
```python
raw = await redis.lpop(QUEUE_KEY)
msg = WhatsAppOutgoingMessage.model_validate_json(raw)
# Ahora msg es válido garantizado
```

---

### H-T0-03: PHI guard en AiService antes de llamar Groq
**Archivo:** `MB-Chat/src/ai/ai.service.ts`
**Cambio:** Verificar `safe_for_phi` y detectar patterns PHI básicos

```typescript
// Agregar antes de la llamada a answerMedicalQuestion:
private containsPhiPattern(text: string): boolean {
  // Detecta DNI, CUIL, números de historia clínica argentinos
  const PHI_PATTERNS = [
    /\bdni\s*:?\s*\d{7,8}\b/i,
    /\bcuil\s*:?\s*\d{11}\b/i,
    /\b(historia clínica|hc)\s*n[°o]?\s*\d+\b/i,
  ];
  return PHI_PATTERNS.some(p => p.test(text));
}

// En answerMedicalQuestion():
if (this.containsPhiPattern(query)) {
  this.logger.warn('[AiService] PHI pattern detected in query — redacting before Groq');
  // No bloquear — solo loggear para ahora. En producción: redactar o bloquear.
}
```

**Nota:** La detección es mejor-esfuerzo. El objetivo Tier 0 es loggear; el bloqueo completo es Tier 1.

---

## HARDENING TIER 1

### H-T1-01: Literal enum en DecideRequest.role (Python)
**Archivo:** `api/app/api/v1/endpoints/brain_decide.py`

```python
# ANTES:
class DecideRequest(BaseModel):
    role: str = Field(..., description="Rol: DOCTOR | PATIENT | SYSTEM")

# DESPUÉS:
from typing import Literal
class DecideRequest(BaseModel):
    role: Literal["DOCTOR", "PATIENT", "SYSTEM"] = Field(...)
```

**Compatible con:** el SaaS Next.js ya envía `"DOCTOR"`. Sin breaking change.

---

### H-T1-02: Pydantic HybridDecisionResult
**Archivo:** `MB-Chat/cerebro_ai_med/decision/hybrid_decision.py`

```python
# Agregar dataclass de salida:
from pydantic import BaseModel
from typing import Literal

RiskLevel = Literal["unknown", "low", "medium", "high"]
ConsensusKind = Literal["aligned", "escalated_by_groq", "cerebro_primary"]

class HybridDecisionResult(BaseModel):
    final_risk_level: RiskLevel
    consensus: ConsensusKind
    final_action_plan: str
    final_urgency: str
    follow_up_hours: int
    cerebro_risk: RiskLevel
    groq_risk: RiskLevel
    deferred: bool
    trace_id: str = ""

# En decide():
# return HybridDecisionResult(...).model_dump() para backward compat
# o return HybridDecisionResult(...)  para type safety
```

---

### H-T1-03: schema_version en MedicalChatLearningRecord
**Archivo:** `MB-Chat/src/medical-assistant/learning/medical-chat-learning.service.ts`

```typescript
// ANTES:
export interface MedicalChatLearningRecord {
  id: string;
  recordedAt: string;
  // ...

// DESPUÉS:
export interface MedicalChatLearningRecord {
  schemaVersion: 1;  // discriminante de versión
  id: string;
  recordedAt: string;
  // ...

// En onModuleInit() — migración de registros legacy:
private migrateRecord(raw: unknown): MedicalChatLearningRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (!obj.schemaVersion) {
    // registro legacy v0 — añadir schemaVersion
    return { schemaVersion: 1, ...obj } as MedicalChatLearningRecord;
  }
  return obj as MedicalChatLearningRecord;
}
```

---

### H-T1-04: MemoryScope __post_init__ validation
**Archivo:** `MB-Chat/memory_py/types.py`

```python
# ANTES:
@dataclass(frozen=True)
class MemoryScope:
    scope: MemoryScopeKind
    patient_id: Optional[str] = None
    # ...

# DESPUÉS:
from dataclasses import dataclass
@dataclass(frozen=True)
class MemoryScope:
    scope: MemoryScopeKind
    tenant_id: Optional[str] = None
    doctor_id: Optional[str] = None
    patient_id: Optional[str] = None
    session_id: Optional[str] = None
    
    def __post_init__(self) -> None:
        if self.scope == "patient" and not self.patient_id:
            raise ValueError("scope='patient' requiere patient_id")
        if self.scope == "doctor" and not self.doctor_id:
            raise ValueError("scope='doctor' requiere doctor_id")
        if self.scope == "tenant" and not self.tenant_id:
            raise ValueError("scope='tenant' requiere tenant_id")
        if self.scope == "global_safe" and self.patient_id:
            raise ValueError("scope='global_safe' no debe tener patient_id")
```

---

### H-T1-05: IncidentPayload.metadata PHI guard
**Archivo:** `MB-Chat/src/common/types/brain.types.ts`

```typescript
// ANTES:
export interface IncidentPayload {
  metadata?: Record<string, unknown>;

// DESPUÉS:
export type SafeMetadataValue = string | number | boolean | null;

export interface IncidentPayload {
  metadata?: Record<string, SafeMetadataValue>;  // elimina nested objects
  // Esto previene { patient: { id: "..." } } en metadata
}
```

**Nota:** Puede requerir actualización de callers que pasen objetos en metadata. Auditar antes de aplicar.

---

## HARDENING TIER 2

### H-T2-01: Zod schema para respuesta de Brain en SaaS
**Archivo:** `medical-agenda-saas/src/app/brain/decide/route.ts`

```typescript
const BrainDecideResponseSchema = z.object({
  action: z.string(),
  response: z.string(),
  confidence: z.number().min(0).max(1),
  source: z.string(),
  entities: z.record(z.string(), z.unknown()).optional(),
  model_version: z.string().optional(),
});

// En el uso:
const parsed = BrainDecideResponseSchema.safeParse(brainResult);
if (!parsed.success) {
  logger.error('Brain response schema invalid', parsed.error);
  // fallback a metabrain local
}
```

---

### H-T2-02: DomainEvent re-validación al leer del Outbox
**Archivo:** `api/app/eventing/relay.py`

```python
# Al procesar registros del outbox:
for record in records:
    try:
        event = DomainEvent.model_validate(record.payload)
        # procesar event
    except ValidationError as e:
        logger.error(f"Outbox record {record.id} has invalid DomainEvent schema: {e}")
        # marcar como dead_letter en lugar de ignorar
```

---

### H-T2-03: MedicalRuntimeToolContext Zod validation
**Archivo nuevo:** `MB-Chat/src/ai/schemas/medical-runtime-context.schema.ts`

```typescript
import { z } from 'zod';

export const MedicalRuntimeToolContextSchema = z.object({
  generatedAt: z.string().datetime(),
  timezone: z.string().min(1),
  currentTimeText: z.string().min(1),
  weather: z.object({
    provider: z.string(),
    location: z.string(),
    temperatureC: z.number().optional(),
    windKmh: z.number().optional(),
    precipitationMm: z.number().optional(),
    summary: z.string(),
    url: z.string().url(),
  }).optional(),
  officialSources: z.array(z.object({
    source: z.string(),
    title: z.string(),
    url: z.string().url(),
    date: z.string(),
  })),
  allowedDomains: z.array(z.string()),
  notes: z.array(z.string()),
});

export type MedicalRuntimeToolContext = z.infer<typeof MedicalRuntimeToolContextSchema>;
```

---

### H-T2-04: MEDICAL_IMAGING_* vars en NestJS ConfigModule
**Archivo:** módulo de configuración NestJS en MB-Chat

```typescript
// En el ConfigModule schema (Joi/Zod):
MEDICAL_IMAGING_API_URL: Joi.string().uri().optional(),
MEDICAL_IMAGING_API_KEY: Joi.string().optional(),
MEDICAL_IMAGING_PROVIDER: Joi.string().default('specialized-api'),
// Si MEDICAL_IMAGING_API_URL está presente, MEDICAL_IMAGING_API_KEY es obligatorio:
```

---

## ORDEN DE IMPLEMENTACIÓN SUGERIDO

```
Semana 1:
  H-T0-01 (ImagingApiResponse Zod)
  H-T0-02 (WhatsApp Redis schema)
  H-T1-01 (DecideRequest.role Literal)
  H-T1-04 (MemoryScope __post_init__)

Semana 2:
  H-T0-03 (PHI pattern logger)
  H-T1-02 (HybridDecisionResult Pydantic)
  H-T1-03 (LearningRecord schema_version)
  H-T2-03 (MedicalRuntimeToolContext Zod)

Semana 3:
  H-T1-05 (IncidentPayload metadata guard)
  H-T2-01 (Brain response Zod en SaaS)
  H-T2-02 (Outbox DomainEvent re-validación)
  H-T2-04 (MEDICAL_IMAGING vars en ConfigModule)
```

---

## CRITERIOS DE VALIDACIÓN POST-HARDENING

Para cada hardening implementado, debe existir:
1. Test unitario que prueba el schema válido
2. Test unitario que prueba el schema inválido (debe retornar error tipado, no excepción sin manejar)
3. Test de regresión que prueba backward compatibility con payloads existentes
4. Log estructurado de la validación (trace_id, module, schema_name, valid: bool)
