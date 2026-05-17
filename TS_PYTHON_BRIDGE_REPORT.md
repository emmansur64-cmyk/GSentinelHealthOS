# TS_PYTHON_BRIDGE_REPORT.md
**GSentinelHealthOS — Reporte de Puentes TypeScript ↔ Python**
**Fecha:** 2026-05-16
**Alcance:** Todos los puntos de intercambio de datos entre módulos TypeScript y Python.

---

## INTRODUCCIÓN

El sistema tiene múltiples puentes TS↔Python. Cada puente es un punto de riesgo porque:
1. TypeScript tiene tipado estático en compilación; Python tiene validación en runtime (Pydantic)
2. Los schemas no están sincronizados automáticamente — cualquier cambio en uno requiere cambio manual en el otro
3. No hay contrato binario compartido (como protobuf/gRPC) — todo es JSON sobre HTTP
4. No hay tests de contrato cross-language (contract tests TS↔Python)

---

## BRIDGE-01: SaaS Next.js → Brain FastAPI (/brain/decide)
**Criticidad: ALTA**
**Protocolo:** HTTP POST / JSON

### Lado TypeScript (SaaS):
```typescript
// medical-agenda-saas/src/app/brain/decide/route.ts
const requestSchema = z.object({
  role: z.literal("DOCTOR"),
  message: z.string().trim().min(1).max(4000),
  context: z.record(z.string(), z.unknown()).default({}),
}).strict();

// Mapeo manual de context hacia el formato del Brain:
const patient = context.patient ? {
  id: String(context.patient.id ?? ""),
  name: String(context.patient.name ?? ""),
  notes: String(context.patient.notes ?? "") || null,
} : null;
```

### Lado Python (Brain FastAPI):
```python
# api/app/api/v1/endpoints/brain_decide.py
class PatientCtx(BaseModel):
    id: str | None = None
    name: str | None = None
    notes: str | None = None

class DecideContext(BaseModel):
    doctor_id: str | None = None
    patient: PatientCtx | None = None
    current_appointment: AppointmentCtx | None = None
    recent_history: list[dict[str, Any]] = Field(default_factory=list)
    conversation_history: list[ConversationTurn] = Field(default_factory=list)
    clinical_state: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

class DecideRequest(BaseModel):
    role: str = Field(..., description="Rol: DOCTOR | PATIENT | SYSTEM")
    message: str = Field(..., min_length=1, max_length=4000)
    context: DecideContext = Field(default_factory=DecideContext)
```

### Divergencias identificadas:
| Campo | TS Zod | Python Pydantic | Riesgo |
|---|---|---|---|
| `role` | `z.literal("DOCTOR")` | `str` sin restricción | ALTO — Python acepta cualquier string |
| `context` | `z.record(z.string(), z.unknown())` | `DecideContext` estructurado | MEDIO — TS no valida estructura interna |
| `context.recent_history` | No tipado en TS side | `list[dict[str,Any]]` en Python | ALTO — sin schema de ítem |
| `context.conversation_history` | No tipado en TS side | `list[ConversationTurn]` en Python | MEDIO — Python valida pero TS no |

### Respuesta del Brain — lado Python produce, lado TS consume sin schema:
```python
# Python retorna (inferido del código):
# {"action": str, "response": str, "confidence": float, "source": str, "entities": dict, "model_version": str}
```
```typescript
// TS consume sin Zod:
return ok({
  action: brainResult.action,        // acceso sin .safeParse()
  response: brainResult.response,
  confidence: brainResult.confidence,
  source: brainResult.source ?? 'brain',
})
```

---

## BRIDGE-02: MB-Chat NestJS → API FastAPI (/appointments)
**Criticidad: MEDIA**
**Protocolo:** HTTP POST / JSON

### Lado TypeScript:
El `MedicalAssistantService` puede invocar appointment endpoints a través del `BrainService`. El contrato de appointment en Python tiene Pydantic `AppointmentCreate`. No hay evidencia directa de que NestJS MB-Chat llame directamente a appointments — el flujo va Doctor→Chat→Brain→API. El riesgo es indirecto.

---

## BRIDGE-03: WhatsApp Gateway Python → Brain NLU Python (Redis)
**Criticidad: ALTA**
**Protocolo:** Redis Queue (no HTTP)

```python
# whatsapp_gateway/app/outgoing_consumer.py
# Lee mensajes de Redis sin schema formal
# El mensaje en Redis viene del Brain Python
```

Este puente es Python↔Python pero via Redis, lo que lo hace equivalente a un puente de contrato: ambos lados deben acordar el formato del mensaje en Redis. No hay schema Pydantic para los mensajes en la queue.

---

## BRIDGE-04: cerebro_ai_med Python → MB-Chat NestJS (HTTP)
**Criticidad: ALTA**
**Protocolo:** HTTP POST / JSON

El `HybridDecisionOrchestrator` en Python invoca `GroqLanguagePipeline` (también Python). El resultado del Hybrid Decision puede ser consumido por módulos NestJS de MB-Chat.

### Problema:
```python
# cerebro_ai_med/decision/hybrid_decision.py
return {
    "final_risk_level": final_risk,       # str
    "consensus": consensus,               # str literal  
    "final_action_plan": final_action_plan,  # str
    "final_urgency": final_urgency,       # str
    "follow_up_hours": follow_up_hours,   # int
    # ← dict literal, sin Pydantic
}
```

Si MB-Chat NestJS consume esta respuesta, no hay schema Zod que valide la estructura recibida.

---

## BRIDGE-05: confidence_py → NestJS (potencial)
**Criticidad: MEDIA**
**Protocolo:** HTTP (si se activa) / In-Process Python

Los tipos `ClinicalConfidenceInput`, `HallucinationRisk`, `MultimodalConflictResult` están definidos en Python. Si en el futuro se exponen via FastAPI y MB-Chat NestJS los consume, cada campo deberá tener mapping TS equivalente.

**Actualmente:** El confidence engine Python está en el módulo MB-Chat pero no hay evidencia de que se invoque desde NestJS. Es un riesgo latente para cuando se integre.

---

## BRIDGE-06: memory_py → NestJS (potencial — shadow mode)
**Criticidad: ALTA cuando se active**
**Protocolo:** HTTP (cuando se active)

```python
# MB-Chat/memory_py/types.py
@dataclass
class MemoryEntry:
    id: str
    tenant_id: str
    doctor_id: str
    scope: MemoryScopeKind
    kind: str
    content: str
    sanitized_content: str
    # ... 10+ campos
```

No hay equivalente TypeScript de `MemoryEntry` con validación Zod en NestJS. Cuando la memoria se active, el puente estará sin contrato en el lado TS.

---

## BRIDGE-07: Prisma (SaaS) ↔ SQLAlchemy (API FastAPI)
**Criticidad: MEDIA**
**Protocolo:** No directo — dos ORMs sobre la misma DB

**Riesgo:** Ambos sistemas acceden a la misma base de datos con sus propios ORMs. Los modelos de Prisma y los modelos SQLAlchemy deben estar sincronizados con la migración Alembic.

**Evidencia de riesgo:** Si el SaaS Next.js hace una migración Prisma y el API FastAPI no actualiza sus modelos SQLAlchemy, hay corrupción silenciosa de datos.

**Mitigación existente:** `alembic.ini` en raíz indica que las migraciones de DB son controladas por Alembic. Prisma también tiene su schema (`prisma/schema.prisma`). Se necesita verificar que ambos estén sincronizados.

---

## BRIDGE-08: metabrain/pipeline.py → MB-Chat NestJS (Groq)
**Criticidad: MEDIA**
**Protocolo:** In-Process Python

La `GroqLanguagePipeline` en Python y el `GroqProvider` en NestJS son implementaciones paralelas del mismo concepto pero en lenguajes distintos. Ambas llaman a la API de Groq con prompts en español. No hay evidencia de que compartan templates de prompts.

**Riesgo de drift de prompts:** Los prompts en `metabrain/prompts/*.txt` pueden divergir de los prompts en `MB-Chat/src/ai/prompts/`.

---

## INVENTARIO COMPLETO DE BRIDGES TS↔Python

| # | Bridge | Protocolo | Productor | Consumidor | Schema TS | Schema Python | Sincronizado | Riesgo |
|---|---|---|---|---|---|---|---|---|
| BR-01 | SaaS → Brain /brain/decide | HTTP/JSON | Next.js | FastAPI | Zod (parcial) | Pydantic (parcial) | NO — divergente | ALTO |
| BR-02 | MB-Chat → API /appointments | HTTP/JSON | NestJS | FastAPI | Ninguno | Pydantic | NO | MEDIO |
| BR-03 | WhatsApp Gateway ↔ Brain | Redis/Queue | Python | Python via Redis | N/A | Ninguno | N/A | ALTO |
| BR-04 | cerebro_ai_med → MB-Chat | HTTP/JSON | Python | NestJS | Ninguno | dict literal | NO | ALTO |
| BR-05 | confidence_py ↔ NestJS | Futuro HTTP | Python | NestJS | Ninguno | dataclass | NO | MEDIO |
| BR-06 | memory_py ↔ NestJS | Futuro HTTP | Python | NestJS | Ninguno | dataclass | NO | ALTO |
| BR-07 | Prisma ↔ SQLAlchemy | DB directa | SaaS | API | Prisma schema | SQLAlchemy | VERIFICAR | MEDIO |
| BR-08 | metabrain prompts ↔ NestJS prompts | Ninguno | Python | NestJS | archivos .txt | archivos .txt | SIN MECANISMO | BAJO |

---

## RECOMENDACIONES PARA BRIDGES

### Inmediato (antes de producción):
1. **BR-01:** Agregar Zod schema para la respuesta completa del Brain en el SaaS. Añadir `Literal["DOCTOR", "PATIENT", "SYSTEM"]` en Python.
2. **BR-04:** Crear Pydantic `HybridDecisionResult` y Zod equivalente en NestJS.
3. **BR-03:** Crear Pydantic `WhatsAppQueueMessage` y usar `model_dump()` al escribir en Redis.

### Medio plazo:
4. **BR-07:** Crear test que compare Prisma schema con Alembic migrations automáticamente.
5. **BR-06:** Crear TypeScript interface `MemoryEntryDto` antes de activar memory_py.
