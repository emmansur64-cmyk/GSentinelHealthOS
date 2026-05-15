# AGENDA LAB STABILIZATION FINAL

Fecha local: 2026-05-12

## 1. Estado inicial

Estado inicial confirmado:
- Agenda canonica en `medical-agenda-saas`.
- Stack: Next.js + Prisma + PostgreSQL.
- DB canonica: `gsentinel_saas`.
- Veredicto previo: GO LAB / NO-GO PRODUCCION REAL.

## 2. Arquitectura confirmada

Agenda real:
- `gs_frontend`
- `127.0.0.1:3000`
- build context `medical-agenda-saas`
- DB `gsentinel_saas`

No canonico:
- `gs_api`
- FastAPI
- DB `gsentinel`

## 3. Backend canonico confirmado

Backend canonico:
- Next.js API Routes.
- Prisma.
- Tablas `doctor_profiles`, `patients`, `appointments`, `availability_rules`.

Confirmado:
- Agenda no depende de `gs_api`.
- `doctor_profiles` es el modelo correcto.
- `doctors` es confusion legacy.

## 4. DB confirmada

DB confirmada:
- `gsentinel_saas`

Tablas presentes:
- `patients`
- `appointments`
- `doctor_profiles`
- `availability_rules`
- `agenda_settings`
- `clinic_whatsapp_accounts`
- `incoming_messages`
- `conversation_states`

## 5. Datos LAB creados

Creados/validados:
- `LAB_TEST_TENANT`
- `LAB_TEST_CLINIC`
- `LAB_TEST_SECRETARY`
- `LAB_TEST_DOCTOR`
- `LAB_TEST_PATIENT`
- `LAB_TEST_WHATSAPP`
- availability rule LAB
- agenda settings LAB
- clinic_whatsapp_account LAB con dummy token

## 6. Validacion agenda manual

PASS:
- login autenticado.
- listado doctores.
- listado pacientes.
- listado schedules.
- sugerencias de slots.
- tenant isolation basica.

FAIL:
- crear turno en runtime activo devuelve 500.

Causa:
- imagen baked contiene casts `::uuid` contra columnas Prisma `TEXT`.

Correccion fuente:
- removidos casts `::uuid`.
- bloqueada auto-reasignacion silenciosa con 409 `REQUESTED_SLOT_UNAVAILABLE`.

Limitacion:
- no se hizo rebuild ni deploy, por restriccion absoluta.
- runtime activo sigue con codigo anterior.

## 7. Validacion WhatsApp

PASS:
- cuenta LAB creada.
- webhook inbound local firmado devuelve 200.
- mensaje LAB persistido en `incoming_messages`.

BLOCKED:
- conversation processing.
- respuesta saliente.
- appointment via WhatsApp.
- visualizacion final en agenda.

Motivo:
- prohibido enviar mensajes reales.
- no se ejecuto flujo que llame Meta Graph API.

## 8. Riesgos eliminados

- Confusion `doctors` vs `doctor_profiles` documentada.
- DB canonica separada de DB legacy.
- Datos LAB identificables creados.
- WhatsApp LAB no usa datos reales.
- Fuente corregida para evitar `text = uuid`.
- Fuente corregida para evitar auto-reasignacion silenciosa.

## 9. Riesgos pendientes

- Runtime activo no tiene el fix hasta rebuild LAB.
- Build global falla por `src/chat/chat.service.ts`, fuera de Agenda.
- WhatsApp E2E completo no probado.
- No hay monitoreo/runbook final.
- Hay referencias demo/local que deben bloquearse antes de produccion.
- Cookie `Secure` en HTTP local complica smoke automatizado.

## 10. Que NO esta listo

No esta listo:
- produccion real;
- carga de pacientes reales desde WhatsApp;
- envio real WhatsApp;
- uso de FastAPI como Agenda;
- deploy;
- limpieza de demo/local sin plan.

## 11. Que si quedo estable

Quedo estable en fuente/lab:
- arquitectura canonica documentada;
- datos LAB minimos;
- auth/listados/schedules/suggestions funcionando;
- inbound WhatsApp LAB persistiendo;
- separacion legacy documentada;
- fix fuente para appointments y WhatsApp overlap.

## 12. Veredicto final

**GO LAB**

**NO-GO PRODUCCION**

**NO-GO PRODUCCION REAL**

Motivo:
- create appointment aun falla en runtime activo hasta rebuild LAB controlado.
- WhatsApp E2E completo no pasa.
- build global no pasa por error externo a Agenda.
- no existe runbook/rollback/monitoreo completo.

## Confirmaciones

- NO se toco produccion.
- NO se usaron pacientes reales.
- NO se enviaron mensajes reales.
- NO se hizo deploy.
- NO se borraron tablas.
- NO se uso `git add .`.

