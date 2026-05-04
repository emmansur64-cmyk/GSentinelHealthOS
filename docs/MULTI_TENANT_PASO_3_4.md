# Multi-tenant Paso 3 y 4

Fecha: 2026-04-27

## Alcance

Este paso agrega `clinic_id` nullable a datos clinicos y operativos del backend Python/FastAPI, y crea una dependencia central para resolver la clinica activa.

No ejecuta migraciones, no hace backfill, no endurece columnas a `NOT NULL` y no modifica el webhook POST de WhatsApp.

## Tablas Python cubiertas por migracion

La migracion `alembic/versions/20260427_0020_clinic_id_operational_tables.py` agrega `clinic_id` solo si la tabla existe:

- `patients`
- `doctors`
- `appointments`
- `notification_outbox`
- `google_outbox`
- `bot_knowledge_base`
- `time_slots`
- `slot_audit_log`
- `doctor_schedule_config`
- `appointments_v2`
- `audit_logs`
- `whatsapp_sessions`
- `whatsapp_messages`
- `medical_files`

Las columnas se agregan nullable primero para permitir backfill controlado en produccion.

## Contexto de clinica activa

Se agrega `api/app/dependencies/clinic_context.py`.

La dependencia `get_clinic_context`:

- lee `X-Clinic-Id`
- lee usuario autenticado con JWT actual
- valida que la clinica exista
- valida que la clinica este activa
- valida que el usuario exista
- valida que el usuario este activo
- valida membresia aprobada en `clinic_members`
- expone `current_user`, `current_clinic_id` y `role`

Si falla la pertenencia o aprobacion, registra `cross_clinic_access_denied` sin datos clinicos sensibles.

## Filtrado inicial

Se agrego filtrado por `clinic_id` en servicios Python:

- `PatientService`
- `DoctorService`
- `AppointmentService`

Los metodos aceptan `clinic_id` opcional. Si se pasa, filtran por clinica. Si no se pasa, mantienen compatibilidad legacy para rutas internas aun no migradas.

Se cableo `get_clinic_context` en endpoints Python de:

- `patients`
- `doctors`

## Pendiente

- Backfill de `clinic_id` para datos existentes.
- Endurecer `clinic_id` a `NOT NULL` cuando el backfill este validado.
- Agregar constraints FK donde sea seguro para cada tabla real.
- Cablear contexto de clinica en endpoints de turnos con estrategia separada para API key interna.
- Separar WhatsApp por `phone_number_id -> clinic_id`.
