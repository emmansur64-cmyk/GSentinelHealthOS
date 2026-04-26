-- PostgreSQL hardening: prevent overbooking at DB layer
-- Goal: enforce max 1 appointment per (doctor_id, slot_datetime)
--
-- This script is idempotent and supports these slot column names:
--   - date_time (current backend model)
--   - datetime
--   - appointment_date

BEGIN;

LOCK TABLE appointments IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
    slot_col text;
    duplicates_count bigint;
BEGIN
    SELECT c.column_name
      INTO slot_col
      FROM information_schema.columns c
     WHERE c.table_schema = current_schema()
       AND c.table_name = 'appointments'
       AND c.column_name IN ('date_time', 'datetime', 'appointment_date')
     ORDER BY CASE c.column_name
                WHEN 'date_time' THEN 1
                WHEN 'datetime' THEN 2
                WHEN 'appointment_date' THEN 3
                ELSE 99
              END
     LIMIT 1;

    IF slot_col IS NULL THEN
        RAISE EXCEPTION 'No se encontro columna de turno en appointments (date_time/datetime/appointment_date)';
    END IF;

    -- 1) Detect duplicate keys.
    EXECUTE format(
        'SELECT COUNT(*)
           FROM (
                 SELECT doctor_id, %1$I, COUNT(*) AS c
                   FROM appointments
                  GROUP BY doctor_id, %1$I
                 HAVING COUNT(*) > 1
                ) d',
        slot_col
    )
    INTO duplicates_count;

    RAISE NOTICE 'Duplicados detectados: %', duplicates_count;

    -- 2) Backup rows that are duplicated (for audit/recovery).
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS appointments_duplicate_backup AS
         SELECT *
           FROM appointments a
          WHERE (a.doctor_id, a.%1$I) IN (
                SELECT doctor_id, %1$I
                  FROM appointments
                 GROUP BY doctor_id, %1$I
                HAVING COUNT(*) > 1
          )',
        slot_col
    );

    -- 3) Resolve duplicates keeping only one row per key.
    -- Keep rule:
    --   a) Prefer non-cancelled over cancelled if status exists
    --   b) Then oldest created_at
    --   c) Then lowest id for deterministic tie-break
    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'appointments'
           AND column_name = 'status'
    ) THEN
        EXECUTE format(
            'WITH ranked AS (
                SELECT
                    ctid,
                    ROW_NUMBER() OVER (
                        PARTITION BY doctor_id, %1$I
                        ORDER BY
                            CASE WHEN status = ''cancelled'' THEN 1 ELSE 0 END,
                            created_at ASC NULLS LAST,
                            id ASC
                    ) AS rn
                FROM appointments
            )
            DELETE FROM appointments a
             USING ranked r
             WHERE a.ctid = r.ctid
               AND r.rn > 1',
            slot_col
        );
    ELSE
        EXECUTE format(
            'WITH ranked AS (
                SELECT
                    ctid,
                    ROW_NUMBER() OVER (
                        PARTITION BY doctor_id, %1$I
                        ORDER BY created_at ASC NULLS LAST, id ASC
                    ) AS rn
                FROM appointments
            )
            DELETE FROM appointments a
             USING ranked r
             WHERE a.ctid = r.ctid
               AND r.rn > 1',
            slot_col
        );
    END IF;

    -- 4) Ensure there are no duplicates left.
    EXECUTE format(
        'SELECT COUNT(*)
           FROM (
                 SELECT doctor_id, %1$I, COUNT(*) AS c
                   FROM appointments
                  GROUP BY doctor_id, %1$I
                 HAVING COUNT(*) > 1
                ) d',
        slot_col
    )
    INTO duplicates_count;

    IF duplicates_count > 0 THEN
        RAISE EXCEPTION 'Persisten duplicados luego de limpieza: %', duplicates_count;
    END IF;

    -- 5) Add unique constraint if not present.
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'unique_doctor_datetime'
           AND conrelid = 'appointments'::regclass
    ) THEN
        EXECUTE format(
            'ALTER TABLE appointments
               ADD CONSTRAINT unique_doctor_datetime
               UNIQUE (doctor_id, %1$I)',
            slot_col
        );
    END IF;
END
$$;

COMMIT;

-- Post-checks (read-only)
-- A) Duplicates must be zero
-- Replace slot column if your schema uses another name.
-- SELECT doctor_id, date_time, COUNT(*)
-- FROM appointments
-- GROUP BY doctor_id, date_time
-- HAVING COUNT(*) > 1;

-- B) Confirm constraint exists
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'unique_doctor_datetime';
