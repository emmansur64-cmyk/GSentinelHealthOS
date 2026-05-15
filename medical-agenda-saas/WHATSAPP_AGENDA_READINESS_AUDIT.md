# WHATSAPP AGENDA READINESS AUDIT

Fecha local: 2026-05-12T21:16:36-03:00

Alcance unico: `E:\GSentinelHealthOS\medical-agenda-saas`

Estado: auditoria documental. No se enviaron mensajes.

## 1. Resumen

WhatsApp para Agenda esta implementado en codigo dentro de `medical-agenda-saas`, pero no esta listo para operar con pacientes reales.

Veredicto WhatsApp: **NO-GO PRODUCCION REAL**.

Modo permitido: **GO LAB** con numero controlado, cuenta controlada y pacientes test.

## 2. Codigo detectado

Rutas y modulos relevantes:
- `src/app/api/webhooks/whatsapp/route.ts`
- `src/lib/whatsapp/conversation-engine.ts`
- `src/lib/whatsapp/parse-webhook.ts`
- `src/lib/whatsapp/verify-signature.ts`
- `src/lib/whatsapp/client.ts`
- `src/lib/whatsapp/queue.ts`
- `src/lib/whatsapp/processing-worker.ts`
- `src/lib/whatsapp/dead-letter.ts`
- `src/lib/agenda/consultation-type.ts`

Modelos Prisma relevantes:
- `ClinicWhatsappAccount` -> `clinic_whatsapp_accounts`
- `IncomingMessage` -> `incoming_messages`
- `OutgoingMessage` -> `outgoing_messages`
- `ConversationState` -> `conversation_states`
- `RateLimit` -> `rate_limits`
- `FailedMessage` -> `failed_messages`
- `Appointment.source` permite `whatsapp`

## 3. Cuenta WhatsApp configurada en DB

Base canonica de Agenda: `gsentinel_saas`.

Resultado:
- `clinic_whatsapp_accounts=0`.

Conclusion:
- No existe cuenta WhatsApp configurada para Agenda en la DB canonica del panel.
- El webhook no puede resolver tenant por `phone_number_id` en produccion real.

Base externa `gsentinel`:
- `client_whatsapp_accounts=0`.

Conclusion:
- Tampoco hay cuenta WhatsApp configurada en la base del API FastAPI externo.

## 4. Tablas de mensajes/conversacion

En `gsentinel_saas` existen las tablas:
- `incoming_messages`
- `outgoing_messages`
- `conversation_states`
- `rate_limits`
- `failed_messages`

Conteos:

| Tabla | Conteo |
|---|---:|
| incoming_messages | 0 |
| outgoing_messages | 0 |
| conversation_states | 0 |
| failed_messages | 0 |

Conclusion:
- La estructura existe.
- No hay evidencia de trafico WhatsApp procesado.

## 5. Turnos creados desde WhatsApp

En `gsentinel_saas`:
- `appointments=0`.
- `appointments source=whatsapp=0`.

En `gsentinel`:
- `appointments=0`.
- `appointments source=whatsapp=0`.

Conclusion:
- No hay turnos creados desde WhatsApp.
- No hay evidencia de flujo E2E exitoso.

## 6. Flujo E2E demostrado

No demostrado.

Puntos presentes en codigo:
- Verificacion de firma Meta si `WHATSAPP_APP_SECRET` existe.
- Resolucion de tenant por `clinic_whatsapp_accounts.phone_number_id`.
- Idempotencia por `message_id`.
- Cola Redis si esta disponible.
- Fallback inline si Redis no esta disponible.
- Estado conversacional por `tenant_id + phone`.
- Rate limit por telefono.
- Creacion de turno con `source: whatsapp`.
- Idempotency key de turno basada en telefono y horario propuesto.

Bloqueos actuales:
- No hay `clinic_whatsapp_accounts`.
- No hay mensajes entrantes.
- No hay conversations.
- No hay appointments WhatsApp.
- No hay availability rules.
- No hay agenda settings.
- El flujo requiere paciente existente por telefono; si no lo encuentra, responde que se comunique con secretaria.
- No hay evidencia de alta automatica segura de paciente nuevo desde WhatsApp en el flujo canonico auditado.

## 7. Seguridad para cargar pacientes reales

Respuesta: **NO es seguro cargar pacientes reales desde WhatsApp todavia**.

Motivos:
1. No existe cuenta WhatsApp configurada.
2. No hay E2E demostrado.
3. No hay disponibilidad real configurada.
4. No hay runbook de recepcion/errores/reintentos.
5. No hay prueba de tenant isolation para WhatsApp.
6. No hay prueba de duplicados de paciente por telefono.
7. No hay prueba de consentimiento/privacidad operacional para pacientes reales.
8. El API FastAPI externo relacionado con pacientes/doctores devuelve 500 y puede confundir operaciones.

## 8. Prueba minima recomendada en lab

No ejecutar aun. Plan:

1. Crear tenant lab no productivo.
2. Crear medico lab.
3. Crear availability rules lab.
4. Crear paciente test con telefono controlado.
5. Crear `clinic_whatsapp_accounts` con credenciales sandbox/controladas.
6. Enviar webhook de prueba firmado o simulado sin Meta real.
7. Validar `incoming_messages` pendiente.
8. Validar procesamiento a `done`.
9. Validar `conversation_states`.
10. Confirmar turno test.
11. Validar `appointments.source='whatsapp'`.
12. Validar `outgoing_messages`.
13. Validar DLQ ante error.
14. Borrar solo datos test si corresponde, con IDs registrados.

## 9. Veredicto

**GO LAB**

Condiciones:
- Solo pacientes test.
- Solo numero controlado.
- Sin envio real a pacientes.
- Sin carga masiva.
- Sin produccion.

**NO-GO PRODUCCION**

Motivo:
- Sin cuenta WhatsApp configurada.
- Sin E2E.
- Sin availability rules.
- Sin runbook.
- Sin validacion de tenant isolation.

**NO-GO PRODUCCION REAL**

Motivo:
- No cumple criterios de produccion real definidos por auditoria.

