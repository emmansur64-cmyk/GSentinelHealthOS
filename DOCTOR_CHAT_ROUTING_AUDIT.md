# DOCTOR CHAT ROUTING AUDIT

Fecha local: 2026-05-12

## 1. Flujo completo

Flujo real auditado:

1. Frontend doctor:
   - `medical-agenda-saas/src/app/dashboard/doctor/chat/page.tsx`
   - `medical-agenda-saas/src/components/doctor-chat-hub.tsx`
   - `medical-agenda-saas/src/components/doctor-dashboard.tsx`
2. Endpoint HTTP:
   - `POST /chat/doctor`
   - `medical-agenda-saas/src/app/chat/doctor/route.ts`
3. Auth/session:
   - `getAuthenticatedUser()`
   - `canAccessDoctorChat(...)`
   - permite admin o `authUser.userId === doctor_id` con role `doctor|medico`.
4. Service:
   - `medical-agenda-saas/src/chat/chat.service.ts`
5. Chain actual de respuesta:
   - `callGroqDoctorChat(...)`
   - si no hay resultado: `callBrainDecide(...)`
   - si no hay resultado: `metabrain.decide(...)`
6. Brain HTTP:
   - `medical-agenda-saas/src/lib/brain-client.ts`
   - llama `POST ${BRAIN_API_URL}/orchestrate`
7. Orquestador Python:
   - `brain/app.py`
   - `brain/orchestration/orchestrator.py`
   - `brain/core/decision_core.py`
   - `brain/decision_engine/triage_engine.py`
8. Respuesta vuelve a `chat.service.ts`, se audita y se renderiza en el frontend.

No se encontro `E:\GSentinelHealthOS\Panel GSentinelHS`; `Test-Path` devolvio `False`. La UI real auditada esta en `medical-agenda-saas`.

## 2. Role handling

Evidencia:

- `doctor-chat-hub.tsx` envia `doctor_id`, `message`, `context.metadata.chat_request_id`.
- `doctor-dashboard.tsx` envia `doctor_id`, `message`, contexto opcional de paciente/turno y metadata.
- `route.ts` valida acceso, pero no agrega un `assistant_mode` contractual al payload.
- `chat.service.ts:535`, `543`, `560` construye `role: "DOCTOR"` internamente para Groq/Brain/local.
- `brain-client.ts:257-259` llama `/orchestrate` con `{ user_input, session_id, context }`.
- `brain/app.py` `OrchestrationRequest` no tiene `role`, `actor_role`, `assistant_mode`, `channel` ni `caller`.

Conclusion: el rol doctor se valida en Next, pero se pierde como contrato en el boundary hacia Brain `/orchestrate`.

## 3. Intent routing

Para input:

`sabes que dia es hoy`

Ruta estatica probable:

- `MetaBrain/nlu_engine.py:187-215` clasifica cualquier texto no booking/cancel/availability como `general_query`.
- `brain/decision_engine/local_engine.py` incluye `general_query` en `_NO_INFERENCE`.
- Pero `brain/core/decision_core.py:544` ejecuta `evaluate_triage(...)` igualmente si no cae en la rama de baja confianza.

Esto significa que `general_query` no evita triage. Solo evita inferencia ML conceptual, pero no evita `evaluate_triage`.

## 4. Triage activation path

Path exacto que genera la respuesta incorrecta:

1. `chat.service.ts:542` llama `callBrainDecide({ role: "DOCTOR", message, context })`.
2. `brain-client.ts:251-259` llama `/orchestrate` sin role/mode: `user_input`, `session_id`, `context`.
3. `brain/app.py:187-214` delega a `orchestrator.handle_request(...)`.
4. `brain/orchestration/orchestrator.py:393-397` llama `_decision_core_process(...)`.
5. `brain/core/decision_core.py:478` entra a `process_input(...)`.
6. `brain/core/decision_core.py:544` ejecuta `evaluate_triage(user_input, enriched_context)`.
7. `brain/core/decision_core.py:135` usa `context.get("symptoms") or [user_input]`.
8. `brain/decision_engine/triage_engine.py:352-355` si hay `symptoms` pero no reglas, fuerza `best_level = "verde"` y `matched.append("sintoma_generico")`.
9. `brain/core/decision_core.py:222` detecta `matched_criteria` y usa `_build_clinical_triage_message(...)`.
10. `brain/core/decision_core.py:191` genera: `Tus sintomas son de baja urgencia (nivel: VERDE)...`.

## 5. Fallback hierarchy

Orden actual en Doctor Chat:

1. Groq doctor chat, si esta configurado.
2. Brain `/orchestrate`, si Brain responde OK.
3. Brain legacy `/api/v1/brain/decide`, si `/orchestrate` falla.
4. Local TypeScript `metabrain.decide(...)`, solo si Groq y Brain no responden.

Problema: el fallback local TypeScript ya tiene manejo social/date query correcto, pero queda detras de Brain. Si Brain esta disponible, el fix local no se ejecuta.

## 6. Causa raiz exacta

Causa raiz compuesta:

1. El boundary Next -> Brain pierde el modo doctor: `/orchestrate` no recibe `role=DOCTOR` ni `assistant_mode=doctor_professional`.
2. Brain `/orchestrate` es un orquestador de agenda/paciente/triage, no un assistant profesional de medico.
3. `decision_core.process_input(...)` ejecuta triage aunque el intent sea `general_query`.
4. `triage_engine.evaluate(...)` convierte cualquier texto no vacio en sintoma generico verde.
5. La respuesta de triage tiene prioridad porque `matched_criteria=["sintoma_generico"]`.

Resultado: una pregunta no medica de un medico se interpreta como sintoma de paciente y recibe triage.

## 7. Archivos involucrados

Criticos:

- `medical-agenda-saas/src/components/doctor-chat-hub.tsx`
- `medical-agenda-saas/src/components/doctor-dashboard.tsx`
- `medical-agenda-saas/src/app/chat/doctor/route.ts`
- `medical-agenda-saas/src/chat/chat.service.ts`
- `medical-agenda-saas/src/lib/brain-client.ts`
- `brain/app.py`
- `brain/orchestration/orchestrator.py`
- `brain/core/decision_core.py`
- `brain/decision_engine/triage_engine.py`
- `MetaBrain/nlu_engine.py`

Prompt relevante:

- `medical-agenda-saas/src/lib/groq-doctor-chat.ts`, `buildSystemPrompt()`.

## 8. Riesgos clinicos

Riesgo alto:

- Un medico recibe lenguaje dirigido a paciente.
- Preguntas administrativas/sociales pueden activar triage falso.
- Puede generar fatiga, confusion y perdida de confianza en el soporte clinico.
- Si se activa con contexto de paciente, podria mezclar razonamiento profesional con salida de patient-assistant.

## 9. Riesgos de seguridad

Riesgo medio-alto:

- No hay contrato de `assistant_mode` en boundary entre Next y Brain.
- El mismo Brain combina agenda, patient triage y orquestacion generica.
- Fallbacks globales pueden ignorar caller/context.

## 10. Riesgos UX

Riesgo alto:

- El medico pregunta una fecha y recibe triage.
- El UI dice "Chat clinico con MetaBrain", pero la respuesta se comporta como chatbot de paciente.
- El usuario no puede saber que pipeline respondio salvo por `source`.

## 11. Separacion doctor/paciente

Estado actual: insuficiente.

Existe control de acceso de doctor en Next, pero no aislamiento conversacional end-to-end.

Falta:

- `assistant_mode` obligatorio.
- `actor_role` persistente y validado.
- `channel=doctor_chat` propagado a Brain.
- Policy de "triage solo paciente".
- Non-medical bypass antes de Brain.
- Safe default profesional no clinico.

## 12. Readiness para IA clinica

NO-GO para IA clinica activa.

Motivo: el enrutamiento puede activar triage de paciente en chat profesional. Antes de RMN/TAC/RX o MetaBrain clinico activo, el router debe tener aislamiento fuerte por rol y modo.

## 13. Validaciones ejecutadas

Comandos:

- `rg "Tus síntomas son de baja urgencia|baja urgencia|nivel: VERDE|triage|symptom|síntomas|sintomas" -n`
- `rg "doctor.chat|doctor_chat|DoctorChat|handleDoctorChat|chat/doctor|metabrain|callBrainDecide|callGroqDoctorChat" -n`
- Lectura de archivos criticos con `Get-Content`.
- `Test-Path E:\GSentinelHealthOS\Panel GSentinelHS`: `False`.
- `npm run test -- tests/nlp/metabrain-social.test.ts --run`: FAIL, script `test` inexistente.
- `npx vitest run tests/nlp/metabrain-social.test.ts`: PASS, 3 tests.

El test local demuestra que `metabrain.decide(...)` sabe responder fecha/social, pero no cubre el path Brain `/orchestrate`.

## Clasificacion

NO-GO para produccion clinica activa.

GO solo para auditoria/correccion LAB controlada.

