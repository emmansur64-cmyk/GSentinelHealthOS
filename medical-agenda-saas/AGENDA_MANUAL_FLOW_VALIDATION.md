# AGENDA MANUAL FLOW VALIDATION

Fecha local: 2026-05-12

Scope unico: `E:\GSentinelHealthOS\medical-agenda-saas`

## Resultado general

Validacion manual LAB: **PARCIAL**

PASS:
- login
- listado doctores
- listado pacientes
- listado disponibilidad
- sugerencias de slots
- aislamiento basico tenant en doctores

FAIL/BLOCKED:
- creacion de turno en runtime activo
- cancelacion de turno via endpoint, porque no se pudo crear turno
- overlap prevention via endpoint, porque creacion falla antes
- no auto-reasignacion silenciosa en runtime activo, porque la imagen actual aun contiene codigo viejo

## Comandos ejecutados

- `Invoke-WebRequest` contra `http://127.0.0.1:3000`
- `docker logs --tail gs_frontend`
- `npx tsc --noEmit --incremental false --project tsconfig.json`
- `npm run build`

## Pruebas

| Prueba | Endpoint/ruta | Esperado | Obtenido | Estado | Evidencia |
|---|---|---:|---:|---|---|
| Login autenticado | `POST /api/auth/login` | 200 | 200 | PASS | usuario `LAB_TEST_SECRETARY`, tenant `LAB_TEST_TENANT` |
| Listar doctores | `GET /api/doctors` | 200 | 200 | PASS | devuelve `LAB_TEST_DOCTOR` |
| Listar pacientes | `GET /api/patients` | 200 | 200 | PASS | devuelve `LAB_TEST_PATIENT` |
| Listar schedules | `GET /api/schedules` | 200 | 200 | PASS | devuelve availability rule LAB |
| Sugerir slots | `GET /api/appointments/suggestions` | 200 | 200 | PASS | devuelve slot `2026-05-19T15:00:00.000Z` |
| Crear turno | `POST /api/appointments` | 201 | 500 | FAIL | `operator does not exist: text = uuid` |
| Listar turnos tras create | `GET /api/appointments?...` | 200 | 200 | PASS | devuelve `[]` porque create fallo |
| Overlap prevention | `POST /api/appointments` mismo slot | 409 | 500 | FAIL | falla antes de evaluar solapamiento |
| Tenant isolation doctores | check respuesta `/api/doctors` | solo LAB | 1 doctor LAB | PASS | `doctor_count=1` |

## Payload principal usado

```json
{
  "patient_id": "44444444-4444-4444-8444-444444444444",
  "doctor_id": "22222222-2222-4222-8222-222222222222",
  "datetime": "2026-05-19T15:00:00.000Z",
  "duration": 30,
  "status": "scheduled",
  "source": "manual",
  "notes": "LAB_TEST_MANUAL_FLOW primary appointment"
}
```

## Causa raiz del FAIL

El runtime activo usa imagen baked de `gs_frontend`. En esa imagen, rutas de appointments contienen queries raw comparando columnas Prisma `TEXT` con parametros casteados a `uuid`:

- `doctor_id = ${doctorId}::uuid`
- `id <> ${id}::uuid`

PostgreSQL responde:

```text
ERROR: operator does not exist: text = uuid
```

## Correccion fuente aplicada

Se corrigieron las fuentes canonicas para:
- quitar casts `::uuid` en comparaciones contra columnas Prisma `TEXT`;
- bloquear auto-reasignacion silenciosa devolviendo 409 `REQUESTED_SLOT_UNAVAILABLE` cuando el slot asignable no coincide con el solicitado.

Archivos tocados:
- `src/app/api/appointments/route.ts`
- `src/app/api/appointments/[id]/route.ts`
- `src/app/api/appointments/update-status/route.ts`
- `src/app/api/appointments/create-followup/route.ts`
- `src/lib/whatsapp/conversation-engine.ts`

Limitacion:
- El container `gs_frontend` no refleja estos cambios hasta rebuild/deploy LAB controlado.
- Rebuild/deploy estaba prohibido en esta fase.

## Build/typecheck

`npx tsc --noEmit --incremental false --project tsconfig.json`: FAIL por error fuera de Agenda:
- `src/chat/chat.service.ts`
- falta propiedad `phone` en `patient` para el tipo esperado.

`npm run build`: compila bundle, pero falla en TypeScript por el mismo error externo.

No se corrigio ese archivo porque esta fuera del alcance de Agenda.

