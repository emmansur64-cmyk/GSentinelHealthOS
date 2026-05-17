# PRE_PRODUCTION_CONTRACT_STATUS.md
**GSentinelHealthOS — Estado de Contratos para Pre-Producción Clínica**
**Fecha:** 2026-05-16
**Propósito:** Evaluación final de readiness. Gate criteria por categoría. Decisión: ¿Puede el sistema entrar en pre-producción clínica?

---

## CRITERIOS DE EVALUACIÓN

Para pre-producción clínica, cada área debe cumplir:
- **GATE PASS (GP):** Criterio cumplido. No bloquea.
- **GATE WARN (GW):** Riesgo aceptable con mitigación documentada.
- **GATE BLOCK (GB):** Criterio incumplido. Bloquea pre-producción.

---

## GATE 1: SEGURIDAD CLÍNICA — Integridad de datos de pacientes

| Criterio | Estado | Evidencia | Decisión |
|---|---|---|---|
| PHI no enviado a Groq sin control | INCUMPLIDO | `AiService` no verifica `safe_for_phi=false` antes de enviar queries. `PatientCtx.notes` se incluye sin redacción | **GB** |
| Role-based access enforced | PARCIAL | Role se valida en frontend/NestJS pero Python acepta `str` sin Literal | **GW** |
| Aislamiento de datos por Doctor/Paciente | PARCIAL | `MedicalAssistantChatDto.role` es opcional — puede llegar sin role | **GW** |
| Clinical policy evaluation activa | SÍ | `ClinicalPolicyService` existe y evalúa mode/role antes de ejecutar | **GP** |
| Imaging con human review gate | SÍ | `imageHumanReviewRequired: true` en feature flags. CNN no activa en producción | **GP** |

**Gate 1: BLOQUEADO — 1 GB (PHI/Groq)**

---

## GATE 2: CONTRATOS DE ENTRADA — Validación en el borde del sistema

| Criterio | Estado | Evidencia | Decisión |
|---|---|---|---|
| Appointments endpoint (API) | PASS | Pydantic v2 con E.164 phone validation | **GP** |
| Brain Decide endpoint | PARCIAL | `role: str` sin Literal, `recent_history` sin tipo | **GW** |
| MB-Chat MedicalAssistant endpoint | PARCIAL | `message` y `query` ambos opcionales — posible texto vacío | **GW** |
| WhatsApp Gateway webhook | PARCIAL | Tiene validación básica de estructura entrante, no de todos los campos | **GW** |
| Next.js image analysis route | INCUMPLIDO | Sin Zod schema, cast directo `as File` | **GB** |
| SaaS booking form | PASS | Zod schema en route handler | **GP** |

**Gate 2: BLOQUEADO — 1 GB (imagen route SaaS sin schema)**

---

## GATE 3: CONTRATOS DE EVENTOS — Integridad del bus de eventos

| Criterio | Estado | Evidencia | Decisión |
|---|---|---|---|
| DomainEvent tiene schema_version | PASS | `schema_version: int = 1` en Pydantic model | **GP** |
| DomainEvent re-validado al leer del outbox | INCUMPLIDO | Relay lee como raw dict sin re-validar | **GW** |
| WhatsApp Redis queue tiene schema | INCUMPLIDO | Sin schema Pydantic en ninguno de los lados | **GB** |
| Outbox relay procesamiento idempotente | PASS | `processed_at` timestamp + status flag | **GP** |

**Gate 3: BLOQUEADO — 1 GB (WhatsApp Redis sin schema)**

---

## GATE 4: BRIDGES TYPESCRIPT ↔ PYTHON — Coherencia cross-language

| Criterio | Estado | Evidencia | Decisión |
|---|---|---|---|
| ClinicalActorRole consistente TS↔Python | INCUMPLIDO | Python: "SYSTEM", TypeScript: "ADMIN" — rol divergente | **GB** |
| Brain response validado en SaaS | INCUMPLIDO | SaaS accede a campos de Brain response sin Zod | **GW** |
| HybridDecisionResult tiene schema | INCUMPLIDO | dict literal en Python, sin schema Zod en NestJS | **GW** |
| Appointment schema TS↔Python coherente | PASS | Mayormente alineado (gap menor: duration_minutes) | **GP** |

**Gate 4: BLOQUEADO — 1 GB (ClinicalActorRole divergente)**

---

## GATE 5: PROVIDER ISOLATION — Seguridad de IA

| Criterio | Estado | Evidencia | Decisión |
|---|---|---|---|
| Un único Groq provider activo | INCUMPLIDO | Dualidad: `providers/groq/adapter.ts` (disabled) + `src/ai/providers/groq.provider.ts` (activo) | **GW** |
| Capacidades Groq enforced en runtime | INCUMPLIDO | `supports_image: false` no enforced — se puede enviar imagen a Groq | **GB** |
| PHI safety flag enforced | INCUMPLIDO | `safe_for_phi: false` no enforced en AiService | **GB** |
| Feature flags centralizados | INCUMPLIDO | 4 sistemas de feature flags distintos sin coordinación | **GW** |
| Fallback AI provider con contrato | INCUMPLIDO | FallbackProvider sin capabilities contract | **GW** |

**Gate 5: BLOQUEADO — 2 GB (imagen enviada a Groq posible, PHI sin protección)**

---

## GATE 6: APRENDIZAJE Y MEMORIA — Estabilidad del estado aprendido

| Criterio | Estado | Evidencia | Decisión |
|---|---|---|---|
| LearningRecord tiene schema_version | INCUMPLIDO | `MedicalChatLearningRecord` sin `schemaVersion` | **GW** |
| Memoria semántica en shadow mode | PASS | `MemoryFeatureFlags.semanticSearchEnabled: false` | **GP** |
| CNN médica activa en producción | NO — correcto | `SmallMedicalCNN` sin pesos entrenados cargados | **GP** |
| LearningRecord no expone PHI | INCUMPLIDO | `concepts: string[]` puede contener strings de query con PHI | **GW** |

**Gate 6: WARN — 0 GB, 2 GW**

---

## GATE 7: MULTIMODAL PIPELINE — Imagenes médicas

| Criterio | Estado | Evidencia | Decisión |
|---|---|---|---|
| Pipeline imaging deshabilitado por default | PASS | `medicalVisionEnabled: false`, `dicomEnabled: false` | **GP** |
| ImagingApiResponse validado con schema | INCUMPLIDO | `as ImagingApiResponse` cast directo, todos los campos opcionales | **GB** |
| MedicalImagingResult con traceId | INCUMPLIDO | Sin `traceId`, sin `imageHash`, sin `humanReviewRequired` field | **GW** |
| Human review gate activo | PASS | `imageHumanReviewRequired: true` | **GP** |

**Gate 7: BLOQUEADO — 1 GB (ImagingApiResponse sin schema)**

---

## RESUMEN EJECUTIVO DE GATES

| Gate | Nombre | GBs | GWs | Decisión |
|---|---|---|---|---|
| G1 | Seguridad Clínica | 1 | 2 | **BLOQUEADO** |
| G2 | Contratos de Entrada | 1 | 3 | **BLOQUEADO** |
| G3 | Contratos de Eventos | 1 | 1 | **BLOQUEADO** |
| G4 | Bridges TS↔Python | 1 | 2 | **BLOQUEADO** |
| G5 | Provider Isolation | 2 | 3 | **BLOQUEADO** |
| G6 | Aprendizaje y Memoria | 0 | 2 | **WARN** |
| G7 | Multimodal Pipeline | 1 | 1 | **BLOQUEADO** |

**TOTAL: 7 gates — 6 BLOQUEADOS, 1 WARN**
**Total Gate Blocks: 7**
**Total Gate Warns: 14**

---

## VEREDICTO: PRE-PRODUCCIÓN CLÍNICA

```
╔════════════════════════════════════════════════════════════════╗
║  ESTADO: NO APTO PARA PRE-PRODUCCIÓN CLÍNICA                  ║
║  Fecha evaluación: 2026-05-16                                  ║
║  Gate Blocks activos: 7                                        ║
╚════════════════════════════════════════════════════════════════╝
```

---

## ITEMS QUE BLOQUEAN PRE-PRODUCCIÓN (ordenados por riesgo)

### GB-01 (RIESGO MÁXIMO): PHI enviado a Groq sin control
**Solución:** H-T0-03 en CONTRACT_HARDENING_PLAN.md
**Esfuerzo estimado:** 1 día

### GB-02 (RIESGO MÁXIMO): ClinicalActorRole "ADMIN" vs "SYSTEM" divergente
**Solución:** Unificar a `"DOCTOR" | "PATIENT" | "ADMIN"` en ambos lenguajes
**Esfuerzo estimado:** 1 día

### GB-03 (RIESGO ALTO): WhatsApp Redis queue sin schema
**Solución:** H-T0-02 en CONTRACT_HARDENING_PLAN.md
**Esfuerzo estimado:** 1 día

### GB-04 (RIESGO ALTO): ImagingApiResponse cast sin validación
**Solución:** H-T0-01 en CONTRACT_HARDENING_PLAN.md
**Esfuerzo estimado:** 0.5 días

### GB-05 (RIESGO ALTO): Imagen posiblemente enviada a Groq (supports_image no enforced)
**Solución:** Verificar `hasImage && GROQ_CAPABILITIES.supports_image === false` → bloquear antes de llamar Groq
**Esfuerzo estimado:** 0.5 días

### GB-06 (RIESGO ALTO): Next.js image analysis route sin schema
**Solución:** Agregar Zod FormData schema y validar File antes de procesar
**Esfuerzo estimado:** 0.5 días

### GB-07 (RIESGO MEDIO): DecideRequest.role sin Literal en Python
**Solución:** H-T1-01 en CONTRACT_HARDENING_PLAN.md
**Esfuerzo estimado:** 2 horas

---

## CAMINO HACIA PRE-PRODUCCIÓN

**Esfuerzo total estimado para resolver todos los GB:** ~5 días de desarrollo.

**Orden recomendado de implementación:**
1. GB-01 + GB-05 — PHI/Groq safety (mismos archivos, mismo día)
2. GB-02 — ClinicalActorRole unificación (requiere coordinar TS + Python)
3. GB-03 — WhatsApp schema (H-T0-02)
4. GB-04 + GB-06 — Imaging schema (H-T0-01 + SaaS route)
5. GB-07 — DecideRequest Literal (H-T1-01)

**Después de resolver los 7 GBs:** Re-evaluar los 14 GWs. No todos son bloqueantes, pero deben tener plan documentado.

---

## ÁREAS LISTAS PARA PRODUCCIÓN (sin issues)

Las siguientes áreas están correctamente implementadas y pueden operar en producción:
- Appointment CRUD (api/app/schemas/appointment_schema.py) — Pydantic v2 correcto
- Clinical Policy evaluation (MB-Chat) — tipos bien definidos
- Mode guards Python (brain/contracts/core_contracts.py) — validación correcta
- WhatsApp Gateway preflight checks — Redis/credentials verificados al iniciar
- Feature flags de imagen deshabilitados — CNN y DICOM apagados correctamente
- Memory shadow mode — sin riesgo de producción mientras esté apagado
- Human review gate para imaging — correctamente seteado en true
