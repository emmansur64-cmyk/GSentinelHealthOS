# QA Checklist - Google Calendar Integration

## Objetivo

Validar de punta a punta que la sincronizacion de citas con Google Calendar es consistente y resiliente.

## Preconditions

- API backend levantada.
- Migraciones aplicadas.
- Google Calendar habilitado en backend.
- Credenciales Service Account configuradas.
- Calendario compartido con el service account.
- Variables para ejecutar QA:
  - DATABASE_URL
  - GATEWAY_API_KEY (o QA_INTERNAL_API_KEY)
  - QA_API_BASE_URL (opcional, default `http://localhost:8000/api/v1`)
  - GOOGLE_CALENDAR_ID
  - GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 o GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_SERVICE_ACCOUNT_FILE

## Casos y Criterios de Exito

### 1) Crear turno

Validacion:
- Crear cita via API.
- Verificar `google_sync_status = synced`.
- Verificar `google_event_id` no nulo.
- Verificar evento existente en Google por `eventId`.

Criterio de exito:
- La cita queda en DB y el evento existe en Google Calendar.

### 2) Reintento

Validacion:
- Forzar reprocesamiento de `google_outbox` para la misma cita.
- Ejecutar worker dos veces.
- Verificar que `google_event_id` no cambia.

Criterio de exito:
- No se crea evento duplicado (misma referencia `google_event_id`).

### 3) Fallo de Google

Validacion:
- Crear nueva cita.
- Ejecutar worker con `GOOGLE_CALENDAR_ID` invalido para forzar fallo.
- Verificar que la cita sigue existiendo.
- Verificar retries en `google_outbox` (>=1) y estado de retry (`failed`/`pending`).

Criterio de exito:
- El sistema no pierde la cita y el outbox programa reintentos.

### 4) Cancelacion

Validacion:
- Cancelar cita existente.
- Ejecutar worker `google_outbox`.
- Verificar cita en estado `cancelled`.
- Verificar que el evento en Google ya no existe.

Criterio de exito:
- El evento remoto se elimina de Google sin romper la cancelacion local.

## Script de Prueba

Archivo:
- `scripts/qa_google_calendar_integration.py`

Ejecucion:

```powershell
$env:QA_API_BASE_URL='http://localhost:8000/api/v1'
$env:QA_INTERNAL_API_KEY=$env:GATEWAY_API_KEY
$env:DATABASE_URL='postgresql+asyncpg://user:pass@localhost:5432/gsentinel_health'
$env:GOOGLE_CALENDAR_ID='primary'
$env:GOOGLE_SERVICE_ACCOUNT_JSON_BASE64='...'
python scripts/qa_google_calendar_integration.py
```

Salida esperada:
- `QA CHECKLIST RESULT: PASS`
- 4 lineas `[OK]` para cada caso.

## Resultado FAIL - Diagnostico rapido

- `google_event_id missing after create`:
  - revisar credenciales/permiso del service account.
- `Outbox retries did not increment on failure`:
  - revisar worker `process_google_outbox.py` y conectividad DB.
- `Google event still exists after cancellation`:
  - revisar cola `google_outbox` action `delete`, errores y retries.
