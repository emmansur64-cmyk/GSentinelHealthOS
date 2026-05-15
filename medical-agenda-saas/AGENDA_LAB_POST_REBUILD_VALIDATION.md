# AGENDA LAB POST REBUILD VALIDATION

Fecha local: 2026-05-12

## Build y typecheck

| Prueba | Resultado |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `docker compose build frontend` | PASS |
| `docker compose up -d --no-deps frontend` | PASS |

## Smoke HTTP y Agenda

Base URL: `http://127.0.0.1:3000`.

Credenciales usadas: usuario LAB `lab_test_secretary@example.test`; password redactado.

| Prueba | Metodo | Endpoint | Esperado | Obtenido | Resultado | Evidencia |
|---|---|---|---|---:|---|---|
| home | GET | `/` | 200 | 200 | PASS | Next root reachable |
| health | GET | `/api/health` | 200 | 200 | PASS | health endpoint |
| sin auth | GET | `/api/doctors` | 401/403 | 401 | PASS | ruta protegida rechaza anonimo |
| fake auth | GET | `/api/doctors` | 401/403 | 401 | PASS | cookie falsa rechazada |
| login LAB | POST | `/api/auth/login` | 200 | 200 | PASS | `identifier` + `tenant_slug=lab-test-tenant` |
| sesion | GET | `/api/auth/me` | 200 | 200 | PASS | sesion reconocida |
| doctores | GET | `/api/doctors` | 200 | 200 | PASS | `LAB_TEST_DOCTOR` visible por `doctor_profiles` |
| pacientes | GET | `/api/patients` | 200 | 200 | PASS | `LAB_TEST_PATIENT` visible |
| horarios | GET | `/api/schedules` | 200 | 200 | PASS | endpoint responde |
| sugerencias | GET | `/api/appointments/suggestions` | 200 | 200 | PASS | sugerencias devueltas |
| crear turno LAB | POST | `/api/appointments` | 200/201 | 201 | PASS | appointment `f415588d-e315-400d-84b8-972130096919` creado |
| cancelar turno LAB | PATCH | `/api/appointments/:id` | 200 | 200 | PASS | turno LAB cancelado |

## Overlap y no reasignacion silenciosa

Prueba controlada:

- Primer turno LAB en `2026-05-19T15:30:00.000Z`: 201, appointment `1e31950f-e1af-489b-aacc-54e5af472e61`.
- Segundo turno mismo slot: 409.
- Respuesta: `REQUESTED_SLOT_UNAVAILABLE`, con `suggested_datetime=2026-05-26T12:00:00.000Z`.
- Resultado: PASS funcional para la regla critica: no se reasigno silenciosamente a otro horario.
- Limpieza operativa: el turno primario LAB fue cancelado por API con status 200.

## WhatsApp LAB

Prueba inbound firmada:

- Endpoint: `POST /api/webhooks/whatsapp`
- Payload: LAB_TEST, phone number id `LAB_TEST_PHONE_NUMBER_ID`
- Firma: generada con `WHATSAPP_APP_SECRET` del runtime sin exponer secreto
- Status obtenido: 200
- DB: `incoming_messages` recibio `wamid.LAB_REBUILD_20260512_166d8754c65747d3ba7fc68d2f5160e1` con status `pending` y tenant `LAB_TEST_TENANT`.

Limitacion:

- `WHATSAPP_AUTO_BOOT_WORKERS=false`.
- El mensaje quedo en cola/pending.
- `conversation_states`: 0.
- appointments WhatsApp creados en ventana de prueba: 0.

Resultado WhatsApp: PASS inbound firmado; FAIL/BLOCKED E2E conversacional por workers/envio LAB no activados y prohibicion de enviar WhatsApp reales.

