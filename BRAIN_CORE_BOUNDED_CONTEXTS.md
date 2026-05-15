# BRAIN CORE BOUNDED CONTEXTS (LOGICOS, SIN SEPARACION FISICA)

Fecha: 2026-05-15
Estado: diseno logico, sin mover carpetas ni duplicar Brain.

## Reglas globales

- Los 3 contextos son logicos en esta fase.
- Brain Core es unico.
- Ningun contexto puede ejecutar acciones fuera de su dominio.
- Fail-safe: si hay duda de dominio, denegar accion y escalar a humano.

---

## 1) MB-Chat

### Responsabilidades

- Chat medico profesional.
- Soporte de razonamiento clinico para medico/actor autorizado.
- Uso de contexto clinico minimo y explicito (por referencia).

### Prohibiciones

- No agendar turnos directamente.
- No modificar agenda.
- No manejar WhatsApp directo.
- No ejecutar triage patient-facing cuando `assistant_mode=doctor_professional`.
- No leer planillas administrativas.

### Datos permitidos

- `request_id`, `tenant_id`, `actor_id`, `actor_role`.
- `message`.
- `patient_context_ref` opcional.
- Historial conversacional reducido y auditado.

### Datos prohibidos

- Historia clinica completa por default.
- Credenciales/provider keys.
- Campos de ingestion administrativa.

### Endpoints permitidos (existentes)

- `POST /chat/doctor` (entrypoint app actual)
- `POST /orchestrate` (Brain Core)
- `POST /api/v1/brain/decide` solo fallback legacy controlado

### Scopes esperados

- `doctor`, `admin` (segun endpoint actual)
- `actor_role=doctor` para pipeline clinico profesional

### Fallbacks seguros

- Si provider falla: fallback a Brain Core local/legacy sin exponer internals.
- Si contrato invalido: `safe_response` no clinico + `requires_human_review=true`.

---

## 2) MB-Secretaria

### Responsabilidades

- Leer planillas/documentos.
- Normalizar disponibilidad medica.
- Preparar carga administrativa.
- Proponer acciones de agenda via Agenda API (sin escritura directa DB desde contrato BrainAction).

### Prohibiciones

- No diagnostico medico.
- No chat clinico.
- No acceso a historia clinica no necesaria.
- No comunicacion con pacientes por WhatsApp.

### Datos permitidos

- `document_ref`, `import_mode` (`preview|apply`).
- Metadatos operativos de agenda.
- Identificadores de doctor/disponibilidad.

### Datos prohibidos

- Hallazgos clinicos sensibles no necesarios.
- Historial clinico completo.
- Mensajeria paciente-canal.

### Endpoints permitidos (existentes)

- `POST /api/import/agenda/parse`
- Futuro: endpoints Agenda API de propuesta/aplicacion, siempre via contrato

### Scopes esperados

- `secretary`, `admin`, `clinic_admin`, `receptionist` (alineado con route actual)

### Fallbacks seguros

- Si OCR/AI falla: respuesta estructurada `DOCUMENT_AI_EXTRACTION_FAILED`, sin inventar datos.
- `import_mode=preview` como default conservador.

---

## 3) MB-Whatsapp

### Responsabilidades

- Conversacion WhatsApp.
- Intencion de turno.
- Confirmacion/cancelacion/reprogramacion.
- Captura minima de datos administrativos.

### Prohibiciones

- No diagnostico medico.
- No historia clinica completa.
- No razonamiento clinico profundo.
- No lectura de planillas.

### Datos permitidos

- `whatsapp_message_id`.
- `patient_phone_ref` o `phone_hash`.
- `message`.
- Estado conversacional administrativo de agenda.

### Datos prohibidos

- `clinical_diagnosis`.
- `full_clinical_history_access`.
- `spreadsheet_ingest`.

### Endpoints/canales permitidos (existentes)

- Canal interno WhatsApp engine (BullMQ/Prisma) en `conversation-engine.ts`.
- Worker Redis legacy (`BrainWorker`) solo si flag legado.
- Llamada a Brain limitada a contrato de `appointment_booking`.

### Scopes esperados

- contexto de tenant/clinic (`tenant_id`, `clinic_id`) + identidad de canal.

### Fallbacks seguros

- Si IA falla: respuestas acotadas a agenda y escalamiento humano.
- Si pedido es clinico profundo: bloquear y derivar a canal medico profesional.

---

## Matriz rapida de permitidos/prohibidos

| Contexto | Permitido | Prohibido |
|---|---|---|
| MB-Chat | `clinical.chat_response`, `human.escalate` | `appointment_write`, `whatsapp_send`, `spreadsheet_ingest` |
| MB-Secretaria | `document.parse_preview`, `document.import_schedule`, `appointment.create_proposal` | `clinical_diagnosis`, `whatsapp_send`, `full_clinical_history_access` |
| MB-Whatsapp | `appointment.search_availability`, `appointment.confirm`, `appointment.cancel_request`, `appointment.reschedule_request` | `clinical_diagnosis`, `full_clinical_history_access`, `spreadsheet_ingest` |

## Principio de cierre

Cualquier `assistant_mode` desconocido o combinacion dominio-tool invalida debe fallar cerrado con:

- `forbidden_action_detected=true`
- `requires_human_review=true`
- sin ejecutar accion de escritura
