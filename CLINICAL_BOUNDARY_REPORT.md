# CLINICAL_BOUNDARY_REPORT.md
**GSentinelHealthOS — Reporte de Aislamiento Clínico**
**Fecha:** 2026-05-16
**Alcance:** Análisis de fronteras PHI, mezcla de roles, aislamiento de contextos clínicos.
**Metodología:** Inspección directa del código real. Sin suposiciones.

---

## DEFINICIÓN DE BOUNDARIES CLÍNICOS

Un **boundary clínico** es cualquier punto en el sistema donde:
- Datos de paciente (PHI) cruzan un módulo
- Roles de usuario (DOCTOR / PATIENT / ADMIN / SECRETARY) se mezclan o confunden
- Contexto clínico (diagnóstico, historial, imagen médica) llega a módulos no clínicos
- Decisiones de AI con impacto clínico se ejecutan sin aislamiento

---

## BOUNDARY-01: Aislamiento Doctor vs Paciente en MB-Chat
**Estado: CORRECTO con gaps**

**Evidencia de aislamiento:**
```typescript
// MB-Chat/src/medical-assistant/clinical-policy/clinical-policy.types.ts
export type ClinicalActorRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';
export type ClinicalAssistantMode = 'doctor_professional' | 'clinical_support';

// El MedicalAssistantService resuelve el rol antes de ejecutar:
const actorRole: ClinicalActorRole = explicitRole ?? this.toClinicalActorRole(roleClassification.role);
// Pre-policy evaluation separa por rol:
const prePolicyResult = evaluateClinicalPolicies({ role: actorRole, ... });
```

**Policies de separación activas:**
- `ProfessionalModePolicy` — requiere modo `doctor_professional` para clinical support
- `DiagnosticBoundaryPolicy` — bloquea diagnósticos si no es rol correcto
- `EmergencyPolicy` — escalada de emergencia en cualquier rol
- `SafeFallbackPolicy` — fallback seguro ante errores de provider

**Gap identificado:**
```typescript
// medical-assistant.types.ts
export class MedicalAssistantChatDto {
  @IsOptional()
  @IsEnum(MedicalAssistantRole)
  role?: MedicalAssistantRole;  // ← OPCIONAL
  // ...
  @IsOptional()
  @IsString()
  userTypeHint?: string;         // ← string libre, no validado contra enum
}
```
**Riesgo:** Si `role` y `userTypeHint` están ambos ausentes, el sistema clasifica el rol via AI (`classifyMedicalRole()`). Un actor malicioso puede omitir el rol y enviar un mensaje que confunda la clasificación AI.
**Nivel de riesgo:** MEDIO — mitigado por ClassificationService, pero no garantizado.

---

## BOUNDARY-02: PHI en IncidentPayload.metadata
**Estado: VULNERABILIDAD ACTIVA**

**Evidencia:**
```typescript
// MB-Chat/src/common/types/brain.types.ts
export interface IncidentPayload {
  metadata?: Record<string, unknown>;  // ← unbounded
}
```

El `IncidentPayload` se usa en:
- `LearningService.record()` — persiste en DB
- `AuditRecord` — persiste en audit log
- `BrainService` — procesa y puede enviar a AI

**Riesgo concreto:** Un caller puede inyectar:
```json
{
  "metadata": {
    "patient_id": "123",
    "diagnosis": "diabetes tipo 2",
    "dni": "30123456"
  }
}
```
Y este payload viaja hasta:
1. `LearningService` → persiste en DB
2. `AiService.analyze()` → va al modelo de lenguaje
3. `AuditRecord` → persiste en audit log

**No hay redacción automática de PHI en IncidentPayload.metadata.**
**Nivel de riesgo:** ALTO — REQUIERE ACCIÓN INMEDIATA.

---

## BOUNDARY-03: PatientCtx en DecideContext — notas clínicas sin redacción
**Estado: VULNERABILIDAD ACTIVA**

**Evidencia:**
```python
# api/app/api/v1/endpoints/brain_decide.py
class PatientCtx(BaseModel):
    id: str | None = None
    name: str | None = None
    notes: str | None = None   # ← campo libre de notas clínicas
```
```typescript
// medical-agenda-saas/src/app/brain/decide/route.ts
patient: {
    id: String((context.patient as Record<string, unknown>).id ?? ""),
    name: String((context.patient as Record<string, unknown>).name ?? ""),
    notes: String((context.patient as Record<string, unknown>).notes ?? "") || null,
}
```

**Riesgo:** El campo `patient.notes` contiene texto clínico libre que:
1. Va al Brain Python (`brain_decide.py`)
2. Se inyecta en el prompt del NLU Engine
3. Puede llegar al modelo Groq como contexto

**No hay sanitización ni redacción del campo `notes` en ninguna capa.**
**Nivel de riesgo:** ALTO.

---

## BOUNDARY-04: MedicalChatLearningRecord — PHI potencial en concepts/citationUrls
**Estado: PARCIALMENTE MITIGADO**

**Evidencia:**
```typescript
// MB-Chat/src/medical-assistant/learning/medical-chat-learning.service.ts
export interface MedicalChatLearningRecord {
  queryHash: string;           // ✓ hash, no plaintext
  concepts: string[];          // ← términos clínicos extraídos — pueden contener PHI si son específicos
  officialSourceUrls: string[]; // ← URLs de fuentes — seguro
  explicitTeaching?: {
    hash: string;
    sanitizedText: string;     // ← sanitizado, pero depende del sanitizer
  };
}
```

**Mitigación existente:** El `queryHash` es SHA correctamente. Las enseñanzas explícitas pasan por sanitizer. El texto de query no se almacena en plaintext.

**Gap:** El array `concepts` se construye con:
```typescript
// Inferido del servicio — no hay evidencia de redacción en la generación de concepts
concepts: this.extractConcepts(query),
```
Si `extractConcepts()` extrae `"paciente Juan García, 45 años"` como concepto, ese PII queda en JSONL sin hash.
**Nivel de riesgo:** MEDIO — requiere auditoría del `extractConcepts()`.

---

## BOUNDARY-05: Memoria Semántica Python — scope patient sin aislamiento garantizado
**Estado: SHADOW MODE ACTIVO — riesgo potencial cuando se active**

**Evidencia:**
```python
# MB-Chat/memory_py/types.py
@dataclass(frozen=True)
class MemoryScope:
    scope: MemoryScopeKind    # "patient" posible
    patient_id: Optional[str] = None  # ← opcional aunque scope="patient"
```

**Mitigación actual:** `SEMANTIC_MEMORY_ENABLED=false` por defecto. El sistema está en shadow mode. Sin embargo, cuando se active:
- `scope="patient"` sin `patient_id` es un estado inválido construible
- `scope="global_safe"` con `patient_id` presente es otro estado inválido
- No hay `__post_init__` que valide coherencia

**Nivel de riesgo actual:** BAJO (shadow mode). Al activar: ALTO.

---

## BOUNDARY-06: Aislamiento WhatsApp — paciente vs sistema
**Estado: CORRECTO**

**Evidencia:**
```python
# brain/contracts/core_contracts.py
WHATSAPP_PROHIBITED_TOOLS = {
    "clinical_diagnosis",
    "full_clinical_history_access",
    "spreadsheet_ingest",
}
```

La integración WhatsApp tiene:
- Lista de herramientas prohibidas explícita
- `evaluate_mode_guard()` valida el modo antes de ejecutar
- `WHATSAPP_ASSISTANT_MODE = "appointment_booking"` — modo restringido

**Estado:** CORRECTO. El canal WhatsApp está correctamente aislado de funcionalidad clínica.

---

## BOUNDARY-07: Secretaria — aislamiento de acceso clínico
**Estado: CORRECTO**

**Evidencia:**
```python
# brain/contracts/core_contracts.py
SECRETARY_PROHIBITED_TOOLS = {
    "clinical_diagnosis",
    "whatsapp_send",
    "full_clinical_history_access",
}
SECRETARY_ASSISTANT_MODE = "secretary_ingestion"
```

El modo secretaria está correctamente separado: puede acceder a agenda pero no a diagnósticos ni historial clínico completo.

---

## BOUNDARY-08: Imaging — aislamiento de análisis de imágenes médicas
**Estado: CORRECTO en feature flags, VULNERABILIDAD en MedicalImagingResult**

**Evidencia flags:**
```typescript
// MB-Chat/imaging/feature-flags.ts
medicalVisionEnabled: false           // ← desactivado
imageHumanReviewRequired: true        // ← revisión humana obligatoria
```

**Vulnerabilidad:**
```typescript
// MB-Chat/src/ai/medical-imaging.service.ts
export interface MedicalImagingResult {
  findings: string;
  probability: number;
  notes: string;
  assisted: true;
  provider: string;
  // ← NO hay patient_id en el resultado
  // ← NO hay trace_id de la imagen original
  // ← NO hay hash de la imagen analizada
}
```

El resultado de imaging no lleva identificador del paciente ni de la imagen analizada, lo que hace imposible auditar:
- "¿Qué imagen del paciente X fue analizada en el turno Y?"
- "¿El resultado corresponde a la imagen enviada?"

**Nivel de riesgo:** ALTO para auditoría, BAJO para fuga de PHI (el resultado no contiene PHI del paciente).

---

## BOUNDARY-09: Provider AI — PHI safe_for_phi flags
**Estado: DECLARADO, NO ENFORCED en runtime**

**Evidencia:**
```typescript
// MB-Chat/providers/groq/capabilities.ts
export const GROQ_CAPABILITIES: ProviderCapabilities = {
  safe_for_phi: false,    // ← correctamente declarado como NO seguro para PHI
```

Sin embargo, en `AiService.answerMedicalQuestion()`:
```typescript
// El servicio inyecta el query médico directamente al Groq provider
// sin verificar si el query contiene PHI ni validar que safe_for_phi=false
// bloquea la llamada
```

**Gap:** El flag `safe_for_phi: false` no está siendo evaluado activamente para bloquear queries con PHI detectado antes de enviar a Groq.
**Nivel de riesgo:** ALTO — PHI detectado en query podría enviarse a Groq.

---

## RESUMEN DE BOUNDARIES CLÍNICOS

| ID | Boundary | Estado | Riesgo PHI | Riesgo Rol | Acción |
|---|---|---|---|---|---|
| B-01 | Doctor vs Paciente en MB-Chat | CORRECTO CON GAPS | BAJO | MEDIO | Hacer `role` obligatorio |
| B-02 | PHI en IncidentPayload.metadata | VULNERABILIDAD | ALTO | NO | Redacción obligatoria |
| B-03 | PatientCtx.notes sin redacción | VULNERABILIDAD | ALTO | NO | Sanitizer en notes |
| B-04 | LearningRecord concepts PHI | PARCIAL | MEDIO | NO | Auditar extractConcepts |
| B-05 | MemoryScope incoherencia | SHADOW MODE | ALTO (futuro) | NO | __post_init__ validation |
| B-06 | WhatsApp aislamiento | CORRECTO | NO | CORRECTO | Ninguna |
| B-07 | Secretaria aislamiento | CORRECTO | NO | CORRECTO | Ninguna |
| B-08 | Imaging sin trace_id | INCOMPLETO | BAJO | NO | Añadir trace_id/patient_id a result |
| B-09 | PHI safe_for_phi no enforced | VULNERABILIDAD | ALTO | NO | Enforce check en AiService |

**Total CORRECTO:** 3
**Total CORRECTO CON GAPS:** 1
**Total INCOMPLETO:** 1
**Total VULNERABILIDAD:** 3
