# BRAIN CORE CURRENT STATE AUDIT

Fecha: 2026-05-15
Objetivo: evidenciar estado real actual antes de modularizacion fisica MB.

## 1. Entry points HTTP reales

### 1.1 Brain HTTP principal

Archivo: `brain/app.py`

- `GET /health`
- `POST /orchestrate`
- Request model real: `OrchestrationRequest`
  - `user_input`
  - `session_id`
  - `context`
  - `assistant_mode`
  - `actor_role`
- Response model real: `OrchestrationResponse`
  - `message`
  - `session_id`
  - `metadata` (`risk_level`, `triage_level`, `flags`, `confidence`, `assistant_mode`, etc.)
- Auth: `X-Internal-Key` via `_verify_internal_key` (usa `settings.internal_services_key`)

### 1.2 Endpoint legacy de decision NLU

Archivo: `api/app/api/v1/endpoints/brain_decide.py`

- Router: `prefix="/brain"`
- Endpoint real: `POST /api/v1/brain/decide` (por include en `api/app/main.py`)
- Request model real: `DecideRequest`
  - `role`
  - `message`
  - `context` (`doctor_id`, `patient`, `current_appointment`, `recent_history`, `conversation_history`, `clinical_state`, `metadata`)
- Response model real: `DecideResponse`
  - `action`
  - `response`
  - `confidence`
  - `source`
  - `entities`
  - `model_version`
- Scope/auth: `validate_api_key`, permite `brain` o `gateway`

## 2. Routing, orchestrator y decision core reales

### 2.1 Routing contracts

Archivo: `brain/contracts/routing.py`

- Enums reales:
  - `AssistantMode`
  - `ActorRole`
  - `TriageEligibilityState`
  - `RoutingDecision`
- Contrato real: `ConversationalContract`
- Factory real: `build_contract(...)`
- Invariantes actuales:
  - `doctor_professional` bloquea triage automatico
  - `NON_TRIAGE_INTENTS` bloquea triage

### 2.2 Role router

Archivo: `brain/routing/role_router.py`

- Clase: `RoleRouter`
- Metodo: `route(...)`
- Funcion: `route_request(...)`
- Rutas principales:
  - `DOCTOR_PIPELINE`
  - `PATIENT_PIPELINE`
  - `TRIAGE_PIPELINE`
  - `SAFE_FALLBACK`

### 2.3 Triage eligibility gate

Archivo: `brain/routing/triage_eligibility.py`

- Clase: `TriageEligibilityValidator`
- Metodo: `validate(...)`
- Salida: `TriageEligibilityResult`
- Requisito explicito actual: sintomas explicitos en contexto

### 2.4 Decision core

Archivo: `brain/core/decision_core.py`

- Funcion central: `process_input(...)`
- Usa:
  - `build_contract` (si no llega contrato)
  - `detect_intent`
  - `evaluate_triage`
  - `generate_response`
- Integraciones internas clave:
  - `MetaBrain.nlu_engine.NLUEngine`
  - `brain.decision_engine.triage_engine`
  - `run_dialogue`, `run_inference`, `run_decision`

### 2.5 Orchestrator HTTP

Archivo: `brain/orchestration/orchestrator.py`

- Clase: `IntelligentOrchestrator`
- Punto entrada: `handle_request(...)`
- Construccion de contrato desde:
  - `assistant_mode` explicito
  - `extra_context.assistant_mode`
  - `_contract_mode`
- Salida metadata incluye:
  - `assistant_mode`
  - `actor_role`
  - `triage_allowed`

## 3. Triage engine real

Archivo: `brain/decision_engine/triage_engine.py`

- Funciones reales:
  - `evaluate(...)`
  - `evaluate_input(...)`
- Tipo salida real:
  - `TriageResult` (`triage_level`, `risk_score`, `recommended_action`, `flags`, `matched_criteria`)

## 4. NLU engine real

Archivo shim: `brain/interpreters/nlu_engine.py`

- Reexporta `MetaBrain.nlu_engine.NLUEngine`

## 5. Brain client / Agenda API / DB llamadas reales

### 5.1 Brain -> Agenda API

Archivo: `brain/integration/api_client.py`

- Headers internos reales:
  - `X-Internal-Key`
  - `X-Client-Id` (tenant client)
  - `X-Clinic-Id` (tenant clinic)
- Llamadas reales:
  - `GET /api/v1/patients/by-phone/{phone}`
  - `GET /api/v1/doctors/specialty/{specialty}`
  - `POST /api/v1/appointments`
  - `GET /api/v1/appointments/patient/{patient_id}`
  - `GET /api/v1/appointments/doctor/{doctor_id}`
  - `POST /api/v1/patients/whatsapp-upsert`
  - `DELETE /api/v1/appointments/{appointment_id}`

### 5.2 WhatsApp worker Brain (legacy + queue)

Archivo: `brain/main.py`

- `BrainWorker` consume Redis queue (`BRPOP`)
- Entrada mensaje esperada: `phone/from`, `text`, `client_id`, `clinic_id`, `phone_number_id`
- Uso de lock por conversacion via `StateManager.conversation_lock(...)`
- Encola salida a cola outgoing

### 5.3 Orquestador WhatsApp Brain

Archivo: `brain/services/orchestrator.py`

- Clase: `BrainOrchestrator`
- Metodo: `handle_message(...)`
- Mezcla actual detectada:
  - NLU
  - intake WhatsApp por estados
  - booking/cancelacion
  - triage
  - no-show

## 6. Entrada de WhatsApp al Brain (evidencia)

### 6.1 Camino Next/BullMQ + Prisma

Archivo: `medical-agenda-saas/src/lib/whatsapp/conversation-engine.ts`

- Funcion principal: `processIncomingMessage(messageId)`
- Lee/escribe DB con Prisma (`incomingMessage`, `conversationState`, `appointment`)
- Llama `generateWhatsAppMetaBrainReply(...)`
- Maneja intents de turno:
  - `create_appointment`
  - `query_appointment`
  - `cancel_appointment`
  - `reschedule_appointment`

### 6.2 Asistente MetaBrain para WhatsApp

Archivo: `medical-agenda-saas/src/lib/whatsapp/metabrain-assistant.ts`

- Puede llamar:
  - `callBrainDecide(...)`
  - `callGroqDoctorChat(...)`
  - fallback `metabrain.decide(...)`
- Esto evidencia acoplamiento de razonamiento clinico en canal WhatsApp

### 6.3 Camino worker Python legacy

Archivo: `brain/main.py`

- `BrainWorker` sigue disponible detras de flag `ENABLE_BRAIN_REDIS_WORKER`

## 7. Entrada de Doctor Chat al Brain (evidencia)

### 7.1 Endpoint doctor chat

Archivo: `medical-agenda-saas/src/app/chat/doctor/route.ts`

- `GET /chat/doctor`
- `POST /chat/doctor`
- `DELETE /chat/doctor`
- Auth/role check: doctor/admin

### 7.2 Servicio doctor chat

Archivo: `medical-agenda-saas/src/chat/chat.service.ts`

- Funcion principal: `handleDoctorChat(...)`
- Construye contexto clinico rico (paciente, appointment, history, metadata)
- Camino de providers:
  1. `callGroqDoctorChat(...)`
  2. fallback `callBrainDecide(...)`
  3. fallback local `metabrain.decide(...)`
- En payload a Brain envia explicitamente:
  - `assistant_mode: "doctor_professional"`
  - `actor_role: "doctor"`

## 8. Entrada de Document/Secretaria/Importacion (evidencia)

Archivo: `medical-agenda-saas/src/app/api/import/agenda/parse/route.ts`

- Endpoint real: `POST /api/import/agenda/parse`
- Roles permitidos: admin/secretaria/recepcionista/clinic_owner/clinic_admin
- Procesa documento (OCR/PDF/Groq/vision)
- Genera:
  - `appointments`
  - `availability_rules`
  - `rows`
- No usa Brain `/orchestrate` para esta fase de importacion
- Usa decision local: `buildAgendaImportGuidance(...)` desde `medical-agenda-saas/src/lib/metabrain.ts`

## 9. Tipos de request/response actuales

### 9.1 `/orchestrate` (Brain)

Request:
- `user_input`, `session_id`, `context`, `assistant_mode`, `actor_role`

Response:
- `message`, `session_id`, `metadata` con trazas de riesgo/triage/flags/assistant_mode

### 9.2 `/api/v1/brain/decide` (API legacy)

Request:
- `role`, `message`, `context`

Response:
- `action`, `response`, `confidence`, `source`, `entities`, `model_version`

### 9.3 Doctor chat response

Desde `chat.service` + route:
- `action`, `response`, `confidence`, `source`, `conversation_id`, `degraded`

### 9.4 Import parse response

Desde `import/agenda/parse`:
- `analysis`, `metabrain`, `appointments`, `availability_rules`, `rows`, matching doctor/header fields

## 10. Auth/scopes/tenant handling

- Brain `/orchestrate`: `X-Internal-Key`
- API `/api/v1/brain/decide`: api key interna + scopes `brain|gateway`
- Tenant routing en Brain->API: `X-Client-Id`, `X-Clinic-Id`
- WhatsApp state scoping por `clinic_id + phone` en `StateManager`
- Frontend doctor chat valida rol y doctor ownership

## 11. Proveedores IA (Groq) reales

- Doctor chat Groq: `medical-agenda-saas/src/lib/groq-doctor-chat.ts`
- WhatsApp Groq: `medical-agenda-saas/src/lib/whatsapp/groq-assistant.ts`
- Document AI Groq: `medical-agenda-saas/src/lib/document-ai.ts`, `.../import/agenda/parse/route.ts`

## 12. Mezcla de responsabilidades detectada

1. WhatsApp canal administrativo comparte piezas con capacidades de chat clinico.
2. Doctor chat y WhatsApp usan proveedores similares (Groq) con riesgo de drift de politicas.
3. Existe doble contrato Brain (`/orchestrate` vs `/api/v1/brain/decide`).
4. Importacion secretaria usa MetaBrain local, no Brain Core, con logica administrativa fuera de bounded context formal.
5. Agenda write hoy ocurre fuera de un contrato BrainAction centralizado.
