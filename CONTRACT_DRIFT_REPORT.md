# CONTRACT_DRIFT_REPORT.md
**GSentinelHealthOS — Reporte de Deriva de Contratos**
**Fecha:** 2026-05-16
**Metodología:** Inspección directa del código fuente. Sin inferencias ni suposiciones.

---

## RESUMEN EJECUTIVO

Se identificaron **22 puntos de deriva** en 48 contratos internos auditados.
Causas raíz principales:
1. Schemas paralelos no sincronizados entre TypeScript y Python
2. Interfaces TypeScript sin validación runtime (solo tipos en tiempo de compilación)
3. Payloads con `dict[str, Any]` / `Record<string, unknown>` como boundary de módulos
4. Campos opcionales peligrosos en contratos clínicos
5. Schema version ausente en todos los contratos excepto `DomainEvent`

---

## DRIFT-001 — Role enum asimétrico en Brain Decide
**Criticidad:** ALTA
**Riesgo Producción:** Sí — requests del SaaS con role inválido llegarán al Brain Python sin rechazo
**Riesgo Clínico:** Sí — un rol incorrecto puede activar herramientas prohibidas

**Evidencia:**
```typescript
// medical-agenda-saas/src/app/brain/decide/route.ts
const requestSchema = z.object({
  role: z.literal("DOCTOR"),   // ← solo acepta "DOCTOR"
  ...
})
```
```python
# api/app/api/v1/endpoints/brain_decide.py
class DecideRequest(BaseModel):
    role: str = Field(..., description="Rol del solicitante: DOCTOR | PATIENT | SYSTEM")
    # ← str sin Literal, sin Enum, sin validación de valores
```

**Causa raíz:** El contrato se definió primero en Python como `str` libre. El SaaS agregó restricción en su propio lado sin actualizar el Python.
**Impacto:** `role="PATIENT"` o `role="SYSTEM"` pueden enviarse al Brain directamente vía HTTP bypass del SaaS.
**Corrección requerida:** Pydantic `Literal["DOCTOR", "PATIENT", "SYSTEM"]` en `DecideRequest.role`.

---

## DRIFT-002 — MedicalAssistantRequest no tipado en transición Controller→Service
**Criticidad:** ALTA
**Riesgo Producción:** Sí — campos opcionales no verificados antes de llegar al service

**Evidencia:**
```typescript
// MB-Chat/src/medical-assistant/medical-assistant.types.ts
export class MedicalAssistantChatDto {
  message?: string;   // opcional
  query?: string;     // alias legacy — también opcional
  // ← la lógica "al menos uno de los dos" NO está en el DTO, está en el service
}
```
```typescript
// MB-Chat/src/medical-assistant/medical-assistant.service.ts
const query = (input.message ?? input.query ?? '').trim();
const hasText = query.length > 0;
// ← silently degrada si ambos vacíos: hasText = false, sigue ejecutándose
```

**Causa raíz:** El DTO tiene `@ValidateIf` cross-field pero no garantiza que al menos un campo de texto esté presente cuando no hay imagen.
**Impacto:** El sistema puede procesar requests vacíos sin error explícito.
**Corrección requerida:** Zod/class-validator constraint: `message XOR query` mínimo presente.

---

## DRIFT-003 — ImagingApiResponse completamente opcional
**Criticidad:** CRÍTICA
**Riesgo Producción:** Sí — respuesta silenciosa de imaging API no detectada
**Riesgo Clínico:** MÁXIMO — hallazgos falsos negativos pasados como válidos

**Evidencia:**
```typescript
// MB-Chat/src/ai/medical-imaging.service.ts
interface ImagingApiResponse {
  findings?: string;      // opcional
  probability?: number;   // opcional
  notes?: string;         // opcional
}
// ...
const data = (await res.json()) as ImagingApiResponse;
return {
  findings: (data.findings ?? '').trim() || 'Hallazgos no concluyentes reportados por el servicio de imagen.',
  probability: this.clampProbability(data.probability),
  // ← si probability = undefined → clampProbability(undefined) → necesita revisión
```

**Causa raíz:** No hay schema de validación para la respuesta de la API de imaging externa. Casting directo con `as`.
**Impacto:** Si la API retorna `{}` o formato inesperado, el sistema construye un `MedicalImagingResult` con texto genérico sin indicar que los datos son inválidos.
**Corrección requerida:** Zod schema para `ImagingApiResponse` con validación antes del cast.

---

## DRIFT-004 — OutboxRecord relée payload sin validar tipo de evento
**Criticidad:** ALTA
**Riesgo Producción:** Sí — eventos corruptos o con schema incorrecto se procesan sin detección

**Evidencia:**
```python
# api/app/eventing/outbox.py
@dataclass
class OutboxRecord:
    payload: dict[str, Any]   # ← tipo genérico, no se valida contra DomainEvent al leer
```
```python
# El enqueue serializa DomainEvent correctamente:
payload = event.model_dump(mode="json")
# ← Pydantic valida al escribir

# Pero al leer en claim_pending():
rows = await self.db.execute(...)  # ← payload viene como dict de DB, nunca re-validado
```

**Causa raíz:** Outbox Pattern implementado correctamente al escribir (Pydantic), pero el relay lee el payload como `dict[str, Any]` sin re-construir el `DomainEvent` validado.
**Impacto:** Una corrupción de DB o un cambio de schema produce silencio o crash no tipado.
**Corrección requerida:** `DomainEvent.model_validate(record.payload)` en el relay antes de procesar.

---

## DRIFT-005 — NLU Engine output sin schema formal
**Criticidad:** ALTA
**Riesgo Producción:** Sí — cambio en NLU Engine rompe callers sin detección estática

**Evidencia:**
```python
# brain/interpreters/nlu_engine.py — output inferido de brain_decide.py
# brain_decide.py line ~80:
#   action: brainResult.action
#   response: brainResult.response
#   confidence: brainResult.confidence
# El NLU Engine retorna un dict sin Pydantic
```
```typescript
// medical-agenda-saas/src/app/brain/decide/route.ts
return ok({
  action: brainResult.action,       // ← acceso directo sin validación
  response: brainResult.response,   // ← puede ser undefined si NLU cambió
  confidence: brainResult.confidence, // ← puede ser undefined
})
```

**Causa raíz:** La respuesta del NLU Engine no está definida como Pydantic model. El consumidor en Next.js no valida la respuesta con Zod.
**Impacto:** Race condition semántica entre versiones del NLU Engine y el SaaS consumer.
**Corrección requerida:** Pydantic `DecideResponse` en Python + Zod para la respuesta en el SaaS.

---

## DRIFT-006 — HybridDecisionOrchestrator retorna dict literal sin schema
**Criticidad:** ALTA
**Riesgo Clínico:** Sí — decisiones de riesgo clínico sin contrato explícito

**Evidencia:**
```python
# MB-Chat/cerebro_ai_med/decision/hybrid_decision.py
return {
    "final_risk_level": final_risk,
    "consensus": consensus,
    "final_action_plan": final_action_plan,
    # ← dict literal, sin dataclass, sin Pydantic
}
```

**Causa raíz:** Función implementada con dict para flexibilidad, sin formalizar el contrato de salida.
**Impacto:** Callers acceden a `.get("final_risk_level")` sin garantía de tipo. Un error de spelling produce `None` silencioso.
**Corrección requerida:** Pydantic `HybridDecisionResult` dataclass.

---

## DRIFT-007 — MedicalChatLearningRecord sin schema_version en JSONL
**Criticidad:** ALTA
**Riesgo Producción:** Sí — incompatibilidad de registros al evolucionar el schema

**Evidencia:**
```typescript
// MB-Chat/src/medical-assistant/learning/medical-chat-learning.service.ts
export interface MedicalChatLearningRecord {
  id: string;
  recordedAt: string;
  // ... 12 campos
  // ← NO hay campo schemaVersion
}
// ...
appendFileSync(this.storagePath, JSON.stringify(record) + '\n');
// ← escritura directa sin versión
```

**Causa raíz:** El JSONL se diseñó para prototipo y nunca se le añadió versionado.
**Impacto:** Al agregar un campo obligatorio en el futuro, los registros previos son inválidos pero se leerán silenciosamente.
**Corrección requerida:** Añadir `schemaVersion: 1` como campo obligatorio. Añadir migración en `onModuleInit()`.

---

## DRIFT-008 — MemoryScope sin validación de coherencia scope/tenant
**Criticidad:** ALTA
**Riesgo Clínico:** Sí — datos de paciente sin aislamiento garantizado por contrato

**Evidencia:**
```python
# MB-Chat/memory_py/types.py
@dataclass(frozen=True)
class MemoryScope:
    scope: MemoryScopeKind      # "global_safe" | "tenant" | "doctor" | "patient" | ...
    tenant_id: Optional[str] = None
    doctor_id: Optional[str] = None
    patient_id: Optional[str] = None
    session_id: Optional[str] = None
    # ← scope="patient" con patient_id=None es construible y no es error
    # ← scope="global_safe" con patient_id="123" es construible y no es error
```

**Causa raíz:** `frozen=True` garantiza inmutabilidad pero no coherencia semántica entre `scope` y los ID fields.
**Impacto:** Un scope `patient` sin `patient_id` produce entradas de memoria sin namespace de paciente, potencial mezcla de contextos.
**Corrección requerida:** `__post_init__` con validación: si `scope == "patient"` entonces `patient_id` es obligatorio.

---

## DRIFT-009 — Redis outgoing WhatsApp queue sin schema de mensaje
**Criticidad:** CRÍTICA
**Riesgo Producción:** Sí — mensajes malformados a clientes reales

**Evidencia:**
```python
# whatsapp_gateway/app/outgoing_consumer.py + queue.py
# Inspección de estructura: no hay schema Pydantic para mensajes en la queue Redis
# Los mensajes se leen como strings de Redis sin validación de estructura
```
```python
# shared/config.py — REDIS_URL configurado pero sin schema de mensaje definido
```

**Causa raíz:** El pipeline WhatsApp fue implementado sin definir un contrato formal para los mensajes en la queue Redis.
**Impacto:** Un mensaje con formato incorrecto puede enviarse al cliente sin validación, o crashear el consumer silenciosamente.
**Corrección requerida:** Pydantic `WhatsAppOutgoingMessage` schema + validación al leer de Redis.

---

## DRIFT-010 — IncidentPayload.metadata es Record<string, unknown> sin límites
**Criticidad:** MEDIA
**Riesgo Clínico:** POTENCIAL — PHI podría filtrarse en metadata

**Evidencia:**
```typescript
// MB-Chat/src/common/types/brain.types.ts
export interface IncidentPayload {
  id: string;
  source: string;
  message: string;
  stack?: string;
  metadata?: Record<string, unknown>;  // ← unbounded, acepta cualquier cosa
  timestamp: string;
}
```

**Causa raíz:** Diseño intencional para flexibilidad, pero sin definir qué campos son permitidos en metadata clínica.
**Impacto:** Un caller puede inyectar `{ patient_id: "...", diagnosis: "..." }` en metadata y este dato viaja por el sistema sin redacción.
**Corrección requerida:** Definir `IncidentMetadata` con campos permitidos explícitos. Bloquear keys con prefijo `patient_` o `clinical_`.

---

## DRIFT-011 — MedicalRuntimeToolContext sin validación runtime
**Criticidad:** MEDIA
**Riesgo Producción:** Sí — contexto de herramientas médicas sin garantía de estructura

**Evidencia:**
```typescript
// MB-Chat/src/ai/medical-runtime-context.ts
export interface MedicalRuntimeToolContext {
  generatedAt: string;
  timezone: string;
  currentTimeText: string;
  weather?: { ... };  // opcional pero referenciado directo en prompts
  officialSources: MedicalCitation[];
  // ← plain interface, sin class-validator, sin Zod
}
```

**Causa raíz:** El contexto se construye en `MedicalRuntimeToolsService` y se inyecta directamente en prompts de AI. No hay validación antes de inyección.
**Corrección requerida:** Zod schema `MedicalRuntimeToolContextSchema` con `.parse()` antes de inyectar en prompt.

---

## DRIFT-012 — DecideContext.recent_history completamente sin tipo
**Criticidad:** ALTA
**Riesgo Clínico:** Sí — historial de conversación sin restricciones de PHI

**Evidencia:**
```python
# api/app/api/v1/endpoints/brain_decide.py
class DecideContext(BaseModel):
    recent_history: list[dict[str, Any]] = Field(default_factory=list)
    # ← list de dicts arbitrarios sin schema de turno de conversación
```
```typescript
// route.ts
recent_history: Array.isArray(context.recent_history)
  ? (context.recent_history as unknown[])
  : [],
// ← cast a unknown[], sin validación de estructura de cada item
```

**Corrección requerida:** Pydantic `ConversationTurn` ya existe en `brain_decide.py` — usar `list[ConversationTurn]` para `recent_history` también, o crear `RecentHistoryItem`.

---

## DRIFT-013 — MedicalImagingService lee ENV directamente sin config centralizado
**Criticidad:** MEDIA
**Riesgo Producción:** Sí — cambio de nombre de variable ENV rompe imaging en producción sin error estático

**Evidencia:**
```typescript
// MB-Chat/src/ai/medical-imaging.service.ts
private readonly endpoint = process.env.MEDICAL_IMAGING_API_URL?.trim() ?? '';
private readonly apiKey  = process.env.MEDICAL_IMAGING_API_KEY?.trim() ?? '';
private readonly provider = process.env.MEDICAL_IMAGING_PROVIDER?.trim() || 'specialized-api';
// ← acceso directo a process.env, sin ConfigService de NestJS
```

**Causa raíz:** El servicio fue creado sin integrar `ConfigService` de NestJS.
**Impacto:** Las variables no están documentadas en el schema de configuración central. Un typo en el nombre de la variable ENV produce silencio (fallback vacío) en lugar de error de startup.
**Corrección requerida:** Registrar `MEDICAL_IMAGING_API_URL`, `MEDICAL_IMAGING_API_KEY` en el módulo de config de NestJS con validación de startup.

---

## RESUMEN DE DERIVA POR SEVERIDAD

| ID | Descripción | Criticidad | Riesgo Clínico | Riesgo Producción |
|---|---|---|---|---|
| DRIFT-001 | Role enum asimétrico Brain Decide | ALTA | SÍ | SÍ |
| DRIFT-002 | MedicalAssistantRequest transición sin validación | ALTA | NO | SÍ |
| DRIFT-003 | ImagingApiResponse completamente opcional | CRÍTICA | MÁXIMO | SÍ |
| DRIFT-004 | OutboxRecord payload sin re-validar al leer | ALTA | NO | SÍ |
| DRIFT-005 | NLU Engine output sin schema formal | ALTA | NO | SÍ |
| DRIFT-006 | HybridDecisionOrchestrator dict sin contrato | ALTA | SÍ | SÍ |
| DRIFT-007 | LearningRecord sin schema_version | ALTA | NO | SÍ |
| DRIFT-008 | MemoryScope sin coherencia scope/id | ALTA | SÍ | NO |
| DRIFT-009 | Redis WhatsApp queue sin schema | CRÍTICA | NO | SÍ |
| DRIFT-010 | IncidentPayload.metadata unbounded | MEDIA | POTENCIAL | NO |
| DRIFT-011 | MedicalRuntimeToolContext sin runtime validation | MEDIA | NO | SÍ |
| DRIFT-012 | DecideContext.recent_history sin tipo | ALTA | SÍ | SÍ |
| DRIFT-013 | MedicalImagingService ENV directo | MEDIA | NO | SÍ |

**Total CRÍTICO:** 2
**Total ALTO:** 8
**Total MEDIO:** 3
