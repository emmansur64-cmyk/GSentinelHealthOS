# DOCTOR CHAT CORRECTIVE ARCHITECTURE

Fecha local: 2026-05-12

## 1. Arquitectura correcta

Separar el chat medico profesional del patient-assistant y de triage.

Flujo propuesto:

Frontend doctor
-> `/chat/doctor`
-> auth doctor
-> `DoctorChatRouter`
-> `DoctorIntentClassifier`
-> `DoctorAssistant`
-> provider/fallback profesional
-> response policy
-> audit trail.

El patient-assistant/WhatsApp debe usar otro router:

WhatsApp/patient
-> `PatientAssistantRouter`
-> appointment intake / triage policy explicita
-> respuesta de paciente.

## 2. Isolation strategy

Contrato obligatorio en todo boundary:

- `channel`: `doctor_chat | patient_whatsapp | receptionist | agenda_import | imaging`
- `actor_role`: `doctor | admin | patient | secretary | system`
- `assistant_mode`: `doctor_professional | patient_triage | appointment_intake | receptionist | imaging_review`
- `tenant_id`
- `doctor_id`
- `patient_id` opcional
- `clinical_context_scope`: `none | selected_patient | selected_appointment`

Regla: Brain debe rechazar o degradar seguro si `assistant_mode` falta.

## 3. Routing rules

Reglas obligatorias para `doctor_professional`:

1. Preguntas sociales o de fecha/hora:
   - responder con utilidad basica.
   - no triage.
   - no patient wording.
2. Preguntas profesionales no clinicas:
   - responder en modo asistente profesional.
   - no triage.
3. Preguntas clinicas generales:
   - responder como soporte al medico.
   - no hablarle al paciente.
   - incluir disclaimer profesional breve solo si corresponde.
4. Contexto de paciente seleccionado:
   - usar datos solo como contexto.
   - no asumir que el usuario es paciente.
5. Triage:
   - prohibido por defecto en `doctor_professional`.
   - permitido solo si intent explicito `doctor_requests_triage` o `patient_triage` y hay datos clinicos suficientes.

## 4. Assistant hierarchy

Orden recomendado para Doctor Chat:

1. Local deterministic router:
   - social/date/time/help/non-medical.
   - safety guard.
   - explicit clinical intent gate.
2. Doctor professional local rules:
   - summary/documentation/follow-up/red flags.
3. Doctor LLM provider, si esta habilitado y permitido.
4. Brain doctor endpoint nuevo:
   - `/doctor/orchestrate` o `/orchestrate` con `assistant_mode=doctor_professional`.
5. Safe fallback profesional:
   - nunca triage de paciente.
   - pedir mas contexto profesional si el input es ambiguo.

Orden NO recomendado:

- Brain patient/triage antes del router local.
- Triage engine como fallback global para cualquier texto.
- `symptoms=[user_input]` para intents `general_query`.

## 5. Safe defaults

Defaults seguros:

- Si `assistant_mode=doctor_professional` y `intent=general_query`: no ejecutar triage.
- Si `input_type=unknown`: responder "Puedo ayudarte con una consulta profesional o con contexto de paciente si seleccionas uno".
- Si Brain falla: usar `metabrain.decide(...)` local.
- Si provider externo falla: no escalar a patient triage.
- Si no hay paciente: no construir "Tus sintomas".

Invariantes:

- Doctor chat nunca debe decir "Tus sintomas..." salvo que el medico pida redactar un mensaje para un paciente y el modo sea explicito.
- Doctor chat nunca debe ofrecer agendar turno como accion principal.
- Patient assistant nunca debe recibir contexto profesional interno.
- Triage nunca debe activarse por texto generico no medico.

## 6. Observabilidad

Agregar trazas no sensibles:

- `assistant_mode`
- `actor_role`
- `route_decision`
- `intent`
- `triage_allowed`
- `triage_executed`
- `provider_selected`
- `fallback_reason`
- `response_policy`

Auditar y alertar si:

- `assistant_mode=doctor_professional` y `response` contiene `Tus sintomas`.
- `assistant_mode=doctor_professional` y `triage_executed=true` sin `doctor_requests_triage`.
- `/chat/doctor` recibe respuesta desde patient/appointment router.

## 7. Rollback

Rollback recomendado para cambios futuros:

1. Feature flag `DOCTOR_CHAT_STRICT_ROUTING=true`.
2. Mantener fallback local actual `metabrain.decide(...)`.
3. Si el router nuevo falla, responder safe default profesional y loguear `doctor_chat.routing_fallback`.
4. No volver automaticamente a Brain patient triage.

## 8. Roadmap MetaBrain clinico

Fase 1:

- Implementar contrato de routing.
- Tests de regresion para inputs no medicos: fecha, saludo, "gracias", "quien sos".
- Tests de no patient wording.

Fase 2:

- Crear `DoctorIntentClassifier`.
- Crear `BrainDoctorOrchestrator` separado o adaptar `/orchestrate` con `assistant_mode` obligatorio.

Fase 3:

- Activar proveedores externos solo detras de policy y auditoria.
- Agregar datasets de regresion de role isolation.

Fase 4:

- Habilitar MetaBrain clinico controlado solo para contexto profesional, con trazabilidad y human-in-the-loop.

## 9. Precondiciones antes de RMN/TAC/RX

Antes de habilitar RMN/TAC/RX o analisis clinico multimodal:

- Role isolation probado.
- `assistant_mode` obligatorio.
- Triage separado de imaging review.
- No patient wording en doctor chat.
- No provider externo sin flag.
- No PHI en logs.
- Tests de regresion para non-medical, clinical, imaging, patient-message-drafting.
- Runbook de rollback.

## 10. Proximo paso seguro

Implementar en LAB una correccion minima:

1. En `chat.service.ts`, ejecutar router local deterministico antes de `callBrainDecide` para social/date/non-medical.
2. Propagar `assistant_mode=doctor_professional` a Brain.
3. En Brain, si `assistant_mode=doctor_professional`, no ejecutar `evaluate_triage` para `general_query`, `unknown`, `small_talk`, `greeting`, `help`.
4. Agregar tests que fallen si aparece `Tus sintomas` en doctor chat para input no medico.

No ejecutar deploy hasta pasar esas pruebas.

