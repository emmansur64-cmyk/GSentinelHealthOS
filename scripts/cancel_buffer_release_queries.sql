-- Cancellation with safe buffer release (PostgreSQL)
-- Goal: do not free blocked slots still covered by another active booking.

BEGIN;

-- 1) Lock appointment + slot context
WITH appt_ctx AS (
    SELECT
        a.id AS appointment_id,
        a.slot_id,
        ts.doctor_id,
        ts.start_time,
        ts.end_time
    FROM appointments a
    JOIN time_slots ts ON ts.id = a.slot_id
    WHERE a.id = :appointment_id
    FOR UPDATE
),
doctor_cfg AS (
    SELECT
        c.*,
        COALESCE(d.buffer_before_minutes, 0) AS buffer_before_minutes,
        COALESCE(d.buffer_after_minutes, 0) AS buffer_after_minutes
    FROM appt_ctx c
    JOIN doctors d ON d.id = c.doctor_id
),
slot_released AS (
    UPDATE time_slots ts
    SET status = 'available'
    FROM doctor_cfg cfg
    WHERE ts.id = cfg.slot_id
    RETURNING ts.id
),
appointment_deleted AS (
    DELETE FROM appointments a
    USING doctor_cfg cfg
    WHERE a.id = cfg.appointment_id
    RETURNING a.id
),
buffer_candidates AS (
    SELECT ts.id, ts.doctor_id, ts.start_time
    FROM time_slots ts
    CROSS JOIN doctor_cfg cfg
    WHERE ts.doctor_id = cfg.doctor_id
      AND ts.status = 'blocked'
      AND ts.start_time >= (cfg.start_time - (cfg.buffer_before_minutes || ' minutes')::interval)
      AND ts.start_time <  (cfg.end_time + (cfg.buffer_after_minutes || ' minutes')::interval)
),
releasable AS (
    SELECT bc.id
    FROM buffer_candidates bc
    CROSS JOIN doctor_cfg cfg
    WHERE NOT EXISTS (
        SELECT 1
        FROM appointments a2
        JOIN time_slots b ON b.id = a2.slot_id
        WHERE a2.status = 'scheduled'
          AND b.status = 'booked'
          AND b.doctor_id = bc.doctor_id
          AND b.id <> cfg.slot_id
          AND (
            (bc.start_time >= (b.start_time - (cfg.buffer_before_minutes || ' minutes')::interval)
             AND bc.start_time < b.start_time)
            OR
            (bc.start_time >= b.end_time
             AND bc.start_time < (b.end_time + (cfg.buffer_after_minutes || ' minutes')::interval))
          )
    )
),
buffers_released AS (
    UPDATE time_slots ts
    SET status = 'available'
    WHERE ts.id IN (SELECT id FROM releasable)
    RETURNING ts.id
)
SELECT
    (SELECT COUNT(*) FROM slot_released) AS released_slot_count,
    (SELECT COUNT(*) FROM appointment_deleted) AS deleted_appointment_count,
    (SELECT COUNT(*) FROM buffers_released) AS released_buffer_count;

COMMIT;

-- ----------------------------------------------------------------------
-- Conflict verification query (single blocked slot candidate)
-- ----------------------------------------------------------------------
-- Returns TRUE if this blocked slot is still needed by another active booking.
SELECT EXISTS (
    SELECT 1
    FROM appointments a
    JOIN time_slots b ON b.id = a.slot_id
    WHERE a.status = 'scheduled'
      AND b.status = 'booked'
      AND b.doctor_id = :doctor_id
      AND b.id <> :released_slot_id
      AND (
        (:blocked_start_time >= (b.start_time - (:buffer_before_minutes || ' minutes')::interval)
         AND :blocked_start_time < b.start_time)
        OR
        (:blocked_start_time >= b.end_time
         AND :blocked_start_time < (b.end_time + (:buffer_after_minutes || ' minutes')::interval))
      )
) AS is_still_blocked_by_other_appointment;
