# Backfill controlado de clinic_id

Fecha: 2026-04-27

## Objetivo

Asignar `clinic_id` a datos existentes antes de endurecer columnas a `NOT NULL`.

Este procedimiento no crea clinicas, no inventa datos y no aplica migraciones destructivas.

## Precondiciones

1. Ejecutar migraciones de Paso 2 y Paso 3/4.
2. Confirmar que existe la clinica real en `clinics`.
3. Elegir explicitamente el `clinics.id` que recibira los datos legacy.

Consultar clinicas:

```sql
SELECT id, name, legal_name, active
FROM clinics
ORDER BY created_at;
```

## Dry-run

```bash
python scripts/backfill_clinic_id.py --clinic-id <CLINIC_UUID>
```

El script informa por tabla:

- si la tabla existe
- si tiene columna `clinic_id`
- cuantas filas tienen `clinic_id IS NULL`

No modifica datos en dry-run.

## Aplicar

```bash
python scripts/backfill_clinic_id.py --clinic-id <CLINIC_UUID> --apply
```

Solo actualiza:

```sql
WHERE clinic_id IS NULL
```

## Tablas incluidas

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

Las tablas inexistentes se informan y se omiten.

## Validacion posterior

```sql
SELECT 'patients' AS table_name, COUNT(*) AS missing FROM patients WHERE clinic_id IS NULL
UNION ALL
SELECT 'doctors', COUNT(*) FROM doctors WHERE clinic_id IS NULL
UNION ALL
SELECT 'appointments', COUNT(*) FROM appointments WHERE clinic_id IS NULL;
```

## Siguiente paso

Solo despues de validar que no quedan filas legacy sin clinica, crear una migracion separada para endurecer `clinic_id` a `NOT NULL` en tablas confirmadas.
