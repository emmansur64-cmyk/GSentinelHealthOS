-- Atomic slot booking with asymmetric doctor buffers (PostgreSQL)
-- Guarantees:
-- 1) Single winner on slot reservation via UPDATE ... WHERE status='available'
-- 2) Buffer blocking happens in same transaction
-- 3) No new slots and no time mutation

BEGIN;

-- Step 1: Reserve slot atomically
WITH reserved AS (
    UPDATE time_slots
    SET status = 'booked'
    WHERE id = :slot_id
      AND status = 'available'
    RETURNING id, doctor_id, start_time, end_time
),
doctor_buffers AS (
    SELECT
        r.id AS slot_id,
        r.doctor_id,
        r.start_time,
        r.end_time,
        COALESCE(d.buffer_before_minutes, 0) AS buffer_before_minutes,
        COALESCE(d.buffer_after_minutes, 0) AS buffer_after_minutes,
        (r.start_time - (COALESCE(d.buffer_before_minutes, 0) || ' minutes')::interval) AS buffer_start,
        (r.end_time + (COALESCE(d.buffer_after_minutes, 0) || ' minutes')::interval) AS buffer_end
    FROM reserved r
    JOIN doctors d ON d.id = r.doctor_id
),
blocked AS (
    UPDATE time_slots ts
    SET status = 'blocked'
    FROM doctor_buffers db
    WHERE ts.doctor_id = db.doctor_id
      AND ts.status = 'available'
      AND ts.start_time >= db.buffer_start
      AND ts.start_time < db.buffer_end
    RETURNING ts.id
),
created_appointment AS (
    INSERT INTO appointments (slot_id, patient_id, status, priority)
    SELECT slot_id, :patient_id, 'scheduled', :priority
    FROM doctor_buffers
    RETURNING id
)
SELECT
    (SELECT COUNT(*) FROM reserved) AS reserved_rows,
    (SELECT COUNT(*) FROM blocked) AS blocked_rows,
    (SELECT id FROM created_appointment LIMIT 1) AS appointment_id;

-- If reserved_rows = 0 => slot not available; application should ROLLBACK.
-- Otherwise COMMIT.

COMMIT;


-- --------------------------------------------------------------
-- Optional function wrapper to simplify backend call
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION book_slot_with_buffers(
    p_slot_id INTEGER,
    p_patient_id INTEGER,
    p_priority TEXT DEFAULT 'normal'
)
RETURNS TABLE (
    success BOOLEAN,
    appointment_id INTEGER,
    blocked_count INTEGER,
    error_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_doctor_id INTEGER;
    v_start_time TIMESTAMPTZ;
    v_end_time TIMESTAMPTZ;
    v_buffer_before INTEGER;
    v_buffer_after INTEGER;
    v_buffer_start TIMESTAMPTZ;
    v_buffer_end TIMESTAMPTZ;
    v_blocked_count INTEGER := 0;
    v_appointment_id INTEGER;
BEGIN
    UPDATE time_slots
    SET status = 'booked'
    WHERE id = p_slot_id
      AND status = 'available'
    RETURNING doctor_id, start_time, end_time
    INTO v_doctor_id, v_start_time, v_end_time;

    IF v_doctor_id IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::INTEGER, 0, 'Slot not available';
        RETURN;
    END IF;

    SELECT
        COALESCE(buffer_before_minutes, 0),
        COALESCE(buffer_after_minutes, 0)
    INTO v_buffer_before, v_buffer_after
    FROM doctors
    WHERE id = v_doctor_id;

    v_buffer_start := v_start_time - (v_buffer_before || ' minutes')::interval;
    v_buffer_end := v_end_time + (v_buffer_after || ' minutes')::interval;

    UPDATE time_slots
    SET status = 'blocked'
    WHERE doctor_id = v_doctor_id
      AND status = 'available'
      AND start_time >= v_buffer_start
      AND start_time < v_buffer_end;

    GET DIAGNOSTICS v_blocked_count = ROW_COUNT;

    INSERT INTO appointments (slot_id, patient_id, status, priority)
    VALUES (p_slot_id, p_patient_id, 'scheduled', p_priority)
    RETURNING id INTO v_appointment_id;

    RETURN QUERY SELECT TRUE, v_appointment_id, v_blocked_count, NULL::TEXT;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, 0, SQLERRM;
END;
$$;
