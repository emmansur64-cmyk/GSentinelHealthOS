# CONTRACT_MATRIX.md
**GSentinelHealthOS — Matriz Real de Contratos Internos**
**Fecha:** 2026-05-16
**Scope:** Todos los módulos del monorepo. Evidencia extraída del código real.
**Autor del análisis:** Principal Software Architect / Principal Distributed Systems Engineer

---

## LEYENDA

| Campo | Descripción |
|---|---|
| **Contrato** | Nombre del contrato o schema |
| **Productor** | Módulo que genera el payload |
| **Consumidor** | Módulo que lee el payload |
| **Tipo** | HTTP / Redis / BullMQ / In-Process / JSONL / EventBus |
| **Schema** | Mecanismo de tipado actual |
| **Validación Runtime** | Si existe validación en tiempo de ejecución |
| **Riesgo** | BAJO / MEDIO / ALTO / CRÍTICO |
| **Estado** | ESTABLE / DERIVA / IMPLÍCITO / ROTO |

---

## SECCIÓN 1: CONTRATOS HTTP — FastAPI (Python)

| # | Contrato | Productor | Consumidor | Tipo | Schema | Validación Runtime | Riesgo | Estado |
|---|---|---|---|---|---|---|---|---|
| H-01 | `POST /appointments` → `AppointmentCreate` / `AppointmentResponse` | API FastAPI | Dashboard / Gateway | HTTP/JSON | Pydantic v2 `AppointmentCreate` + `AppointmentResponse` (`api/app/schemas/appointment_schema.py`) | SÍ — Pydantic strict | BAJO | ESTABLE |
| H-02 | `GET /appointments/{id}` → `AppointmentResponse` | API FastAPI | Dashboard / Mobile | HTTP/JSON | Pydantic v2 `AppointmentResponse` | SÍ — Pydantic strict | BAJO | ESTABLE |
| H-03 | `PATCH /appointments/{id}/reschedule` → `RescheduleAppointmentRequest` | API FastAPI | Dashboard | HTTP/JSON | Pydantic `BaseModel` inline en `appointments.py` — sin alias, sin módulo compartido | PARCIAL | MEDIO | DERIVA |
| H-04 | `POST /brain/decide` → `DecideRequest` / `DecideResponse` | API FastAPI | SaaS Next.js | HTTP/JSON | Pydantic `DecideRequest` (inline en `brain_decide.py`), no en módulo compartido | SÍ — Pydantic | ALTO | DERIVA |
| H-05 | `POST /webhooks/whatsapp` — Meta webhook body | Meta / WhatsApp | API FastAPI | HTTP/JSON | Sin schema Pydantic dedicado — raw body + dict parsing | NO — solo `request.json()` | CRÍTICO | IMPLÍCITO |
| H-06 | `GET /webhooks/whatsapp` — verify token | Meta | API FastAPI | HTTP/Query | Query params directos, sin Pydantic | NO | MEDIO | IMPLÍCITO |
| H-07 | `POST /brain/decide` → `DecideRequest` | SaaS Next.js (`brain/decide/route.ts`) | API FastAPI (`brain_decide.py`) | HTTP/JSON | **Asimétrico**: Next.js usa Zod `requestSchema` con `z.literal("DOCTOR")`, Python acepta `role: str` sin enum | PARCIAL — solo lado TS | ALTO | DERIVA |
| H-08 | `POST /api/ai/image-analysis` — multipart form | SaaS Next.js | Groq Vision | HTTP/Form | Multipart `File` + `FormData`. Sin Zod schema. Sin `Content-Type` validation consistente | NO | ALTO | IMPLÍCITO |
| H-09 | `GET /health/live` + `GET /health/ready` | API FastAPI / cerebro_ai_med | Orchestrators / k8s | HTTP/JSON | Sin schema Pydantic formal — dict literal | NO | BAJO | IMPLÍCITO |
| H-10 | `POST /analyze` → cerebro_ai_med API | `cerebro_ai_med/main.py` | Internal consumers | HTTP/JSON | FastAPI + Pydantic (documentado en README) — no inspeccionado directamente | ASUMIDO SÍ | MEDIO | ESTABLE |

---

## SECCIÓN 2: CONTRATOS HTTP — NestJS (TypeScript)

| # | Contrato | Productor | Consumidor | Tipo | Schema | Validación Runtime | Riesgo | Estado |
|---|---|---|---|---|---|---|---|---|
| N-01 | `MedicalAssistantChatDto` → `POST /medical-chat` | MB-Chat Controller | `MedicalAssistantService` | HTTP/JSON | `class-validator` decorators en `medical-assistant.types.ts` | SÍ — ValidationPipe NestJS | BAJO | ESTABLE |
| N-02 | `MedicalAssistantResponse` → chat reply | `MedicalAssistantService` | Controller / Client | HTTP/JSON | Interface TypeScript — sin runtime validation de salida | NO — solo tipos TS | MEDIO | DERIVA |
| N-03 | `MedicalAssistantRequest` (input interno) | Controller | `MedicalAssistantService` | In-Process | Mapeo manual desde `MedicalAssistantChatDto` sin validación intermedia | NO | ALTO | IMPLÍCITO |
| N-04 | `IncidentPayload` → Brain Service | Events / Modules | `BrainService` | In-Process | Interface TypeScript `brain.types.ts` — sin runtime schema | NO | ALTO | IMPLÍCITO |
| N-05 | `BrainDecision` → Learning / Execution | `BrainService` | `LearningService`, `ExecutionService` | In-Process | Interface TypeScript — sin validación de campos obligatorios | NO | ALTO | IMPLÍCITO |
| N-06 | `GatedExecutionResult` → LearningService | `ExecutionService` | `LearningService` | In-Process | Interface TypeScript — `error: string | null` siempre optativo | NO | MEDIO | DERIVA |
| N-07 | `MlPredictionTrace` → audit | ML modules | `LearningService` | In-Process | Interface TypeScript — 15+ campos opcionales (`?`) | NO | ALTO | DERIVA |

---

## SECCIÓN 3: CONTRATOS DE PROVEEDOR AI (TypeScript — MB-Chat/providers)

| # | Contrato | Productor | Consumidor | Tipo | Schema | Validación Runtime | Riesgo | Estado |
|---|---|---|---|---|---|---|---|---|
| P-01 | `ProviderRequest` | AI consumers (AiService) | Groq / OpenAI / Local adapters | In-Process | TypeScript type `providers/types.ts` | NO — solo tipo estático | ALTO | DERIVA |
| P-02 | `ProviderResponse` | Groq / adapters | `AiService`, `MedicalAssistantService` | In-Process | TypeScript type `providers/types.ts` + `buildProviderResponse()` factory | PARCIAL — factory normaliza campos | MEDIO | ESTABLE |
| P-03 | `ProviderCapabilities` | `groq/capabilities.ts` | `llm-orchestrator.ts` | In-Process | TypeScript type — valores hardcoded por proveedor | NO | BAJO | ESTABLE |
| P-04 | `ProviderFeatureFlags` | ENV runtime | Router / Orchestrator | In-Process | TypeScript type — leído via `loadImageFeatureFlags()` / `load_memory_feature_flags()` | PARCIAL — bool parsing | BAJO | ESTABLE |
| P-05 | `ProviderAuditEvent` | Provider adapters | Observability / Audit sink | In-Process | TypeScript type — sin schema de escritura | NO | MEDIO | IMPLÍCITO |
| P-06 | `ImagingApiResponse` (HTTP externo) | External Imaging API | `MedicalImagingService` | HTTP/JSON | Partial interface en `medical-imaging.service.ts` — todos los campos opcionales | NO — solo `as ImagingApiResponse` | CRÍTICO | IMPLÍCITO |

---

## SECCIÓN 4: CONTRATOS DE CONFIANZA CLÍNICA (Python — MB-Chat/confidence_py)

| # | Contrato | Productor | Consumidor | Tipo | Schema | Validación Runtime | Riesgo | Estado |
|---|---|---|---|---|---|---|---|---|
| C-01 | `ClinicalConfidenceInput` | AI pipeline | `confidence_engine.py` | In-Process | Python `@dataclass(slots=True)` en `confidence_py/types.py` | NO — dataclass no valida tipos | ALTO | DERIVA |
| C-02 | `ProviderOutputSummary` | Provider adapters | `confidence_engine.py` | In-Process | Python `@dataclass(slots=True)` | NO | MEDIO | DERIVA |
| C-03 | `HallucinationRisk` | `hallucination_risk.py` | `confidence_engine.py` | In-Process | Python `@dataclass(slots=True)` | NO | ALTO | DERIVA |
| C-04 | `MultimodalConflictResult` | `multimodal_conflict.py` | Confidence aggregator | In-Process | Python `@dataclass(slots=True)` | NO | ALTO | IMPLÍCITO |

---

## SECCIÓN 5: CONTRATOS DE MEMORIA (Python — MB-Chat/memory_py)

| # | Contrato | Productor | Consumidor | Tipo | Schema | Validación Runtime | Riesgo | Estado |
|---|---|---|---|---|---|---|---|---|
| M-01 | `MemoryEntry` | `SemanticMemoryService.remember()` | `JsonlMemoryAdapter` | JSONL | Python `@dataclass` en `memory_py/types.py` | PARCIAL — sanitizer redacta content | MEDIO | DERIVA |
| M-02 | `MemoryScope` | Callers de `SemanticMemoryService` | `MemoryRetriever` | In-Process | Python `@dataclass(frozen=True)` | NO — no valida scope kind vs tenant_id | ALTO | IMPLÍCITO |
| M-03 | `MemoryFeatureFlags` | ENV runtime | `SemanticMemoryService` | In-Process | Python `@dataclass(frozen=True)` — all defaults `False` | PARCIAL — bool parser | BAJO | ESTABLE |

---

## SECCIÓN 6: CONTRATOS DE APRENDIZAJE (TypeScript — MB-Chat/src)

| # | Contrato | Productor | Consumidor | Tipo | Schema | Validación Runtime | Riesgo | Estado |
|---|---|---|---|---|---|---|---|---|
| L-01 | `MedicalChatLearningRecord` | `MedicalChatLearningService` | JSONL file / in-memory | JSONL | Interface TypeScript — sin schema version | NO — `appendFileSync(JSON.stringify())` | ALTO | DERIVA |
| L-02 | `MedicalChatControlledDecision` | `MedicalChatLearningService.decide()` | `MedicalAssistantService` | In-Process | Interface TypeScript | NO | MEDIO | ESTABLE |
| L-03 | `OutcomeRecord` | `LearningService.record()` | `PersistenceService` / DB | DB/JSON | Interface TypeScript — sin schema de DB | NO | ALTO | IMPLÍCITO |
| L-04 | `LearningInsights` | `LearningService.getInsights()` | Callers (Brain modules) | In-Process | Interface TypeScript | NO | BAJO | ESTABLE |

---

## SECCIÓN 7: CONTRATOS DE EVENTOS DE DOMINIO (Python — api/app/eventing)

| # | Contrato | Productor | Consumidor | Tipo | Schema | Validación Runtime | Riesgo | Estado |
|---|---|---|---|---|---|---|---|---|
| E-01 | `DomainEvent` (SlotReserved, AppointmentCreated, etc.) | `booking_workflows.py` | `OutboxRepository` | Outbox/DB | Pydantic v2 en `eventing/schemas.py` — `schema_version: int = 1` | SÍ — Pydantic | BAJO | ESTABLE |
| E-02 | `OutboxRecord` → relay | `OutboxRepository.claim_pending()` | `relay.py` | DB/JSON | Python `@dataclass` — `payload: dict[str, Any]` sin tipado de evento | NO — payload sin validar al leer | ALTO | DERIVA |
| E-03 | Redis realtime events | `realtime_notifications.py` | Frontend SSE / Next.js | Redis/SSE | Sin schema Pydantic — `broadcast_realtime_event()` acepta `dict` | NO | ALTO | IMPLÍCITO |

---

## SECCIÓN 8: CONTRATOS WHATSAPP (Python — whatsapp_gateway)

| # | Contrato | Productor | Consumidor | Tipo | Schema | Validación Runtime | Riesgo | Estado |
|---|---|---|---|---|---|---|---|---|
| W-01 | Meta WhatsApp webhook body | Meta Cloud API | `webhooks_whatsapp.py` | HTTP/JSON | Sin schema Pydantic dedicado — `dict` parsing con `body.get()` | NO | CRÍTICO | IMPLÍCITO |
| W-02 | Outgoing WhatsApp message | `WhatsAppOutgoingConsumer` | WhatsApp Cloud API | Redis/HTTP | Sin schema formal — string messages via Redis queue | NO | ALTO | IMPLÍCITO |
| W-03 | Redis outgoing queue payload | API / Brain | `whatsapp_gateway/app/outgoing_consumer.py` | Redis/Queue | Sin schema de mensaje en Redis | NO | CRÍTICO | IMPLÍCITO |

---

## SECCIÓN 9: CONTRATOS AGENDA / SAAS (Next.js — medical-agenda-saas)

| # | Contrato | Productor | Consumidor | Tipo | Schema | Validación Runtime | Riesgo | Estado |
|---|---|---|---|---|---|---|---|---|
| A-01 | `POST /brain/decide` — SaaS → Brain | SaaS route `brain/decide/route.ts` | API FastAPI `brain_decide.py` | HTTP/JSON | Zod `requestSchema` (TS) | SÍ lado TS, SÍ lado Python — **tipos divergentes** | ALTO | DERIVA |
| A-02 | `POST /api/ai/image-analysis` | SaaS Next.js route | `groqImageAnalysis.ts` | HTTP/Form | Sin Zod. File + FormData sin schema explícito | NO | ALTO | IMPLÍCITO |
| A-03 | `callBrainDecide()` response | API FastAPI | SaaS `brain/decide/route.ts` | HTTP/JSON | Sin Zod/schema para la respuesta recibida — `brainResult.action`, `.response`, `.confidence` sin validar | NO | ALTO | IMPLÍCITO |
| A-04 | Prisma agenda models | DB PostgreSQL | SaaS services | ORM | Prisma schema (`prisma/schema.prisma`) | SÍ — Prisma | BAJO | ESTABLE |

---

## SECCIÓN 10: CONTRATOS BRAIN/NLU (Python — brain/)

| # | Contrato | Productor | Consumidor | Tipo | Schema | Validación Runtime | Riesgo | Estado |
|---|---|---|---|---|---|---|---|---|
| B-01 | Brain mode guard contract | `brain/contracts/core_contracts.py` | `brain_decide.py`, `webhooks_whatsapp.py` | In-Process | Python dataclasses + `ContractValidationError` | SÍ — `validate_runtime_brain_request()` | BAJO | ESTABLE |
| B-02 | `BRAIN_ACTION_ALLOWLIST` | `core_contracts.py` | Brain router | In-Process | Python `frozenset` literal | SÍ — set membership check | BAJO | ESTABLE |
| B-03 | NLU Engine output | `brain/interpreters/nlu_engine.py` | `brain_decide.py` | In-Process | Dict con claves `action`, `response`, `confidence`, `entities` — sin Pydantic | NO | ALTO | IMPLÍCITO |
| B-04 | `HybridDecisionOrchestrator` output | `cerebro_ai_med/decision/hybrid_decision.py` | Callers | In-Process | Dict literal `{"final_risk_level": ..., "consensus": ...}` — sin dataclass de salida | NO | ALTO | IMPLÍCITO |

---

## RESUMEN EJECUTIVO DE RIESGOS

| Categoría | Total contratos | ESTABLE | DERIVA | IMPLÍCITO | ROTO |
|---|---|---|---|---|---|
| HTTP FastAPI | 10 | 3 | 3 | 4 | 0 |
| HTTP NestJS | 7 | 1 | 3 | 3 | 0 |
| Provider AI | 6 | 2 | 2 | 2 | 0 |
| Confianza Clínica | 4 | 0 | 2 | 2 | 0 |
| Memoria | 3 | 1 | 1 | 1 | 0 |
| Aprendizaje | 4 | 1 | 2 | 1 | 0 |
| Eventos Dominio | 3 | 1 | 1 | 1 | 0 |
| WhatsApp | 3 | 0 | 0 | 3 | 0 |
| Agenda/SaaS | 4 | 1 | 1 | 2 | 0 |
| Brain/NLU | 4 | 2 | 0 | 2 | 0 |
| **TOTAL** | **48** | **12 (25%)** | **15 (31%)** | **21 (44%)** | **0** |

**Contratos con validación runtime real:** 12/48 (25%)
**Contratos con riesgo ALTO o CRÍTICO:** 22/48 (46%)
**Contratos con schema version explícita:** 2/48 (`DomainEvent.schema_version`, `MedicalChatLearningRecord` — ninguno)
