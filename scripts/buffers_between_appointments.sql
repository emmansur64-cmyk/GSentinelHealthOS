/**
 * BUFFERS AUTOMÁTICOS ENTRE TURNOS
 * 
 * Extensión del modelo de slots:
 * - Agregar buffer_minutes configurable por doctor
 * - Al reservar: bloquear slots adyacentes automáticamente
 * - Sin crear slots nuevos (solo marcar existing como 'blocked')
 * 
 * Ejemplo:
 *   Slot 14:00-14:30 reservado
 *   Buffer: 10 min
 *   Resultado:
 *   - 13:50-14:00 → status='blocked'
 *   - 14:00-14:30 → status='booked' (cita)
 *   - 14:30-14:40 → status='blocked'
 */

-- ============================================================================
-- FASE 1: Extender configuración de doctor con buffer_minutes
-- ============================================================================

-- 1A. Agregar columna buffer_minutes a doctor_schedule_config
ALTER TABLE doctor_schedule_config
ADD COLUMN buffer_minutes INT DEFAULT 0 CHECK (buffer_minutes >= 0);

-- Índice para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_doctor_schedule_buffer 
    ON doctor_schedule_config(doctor_id, buffer_minutes);

-- Ejemplo: Establecer diferentes buffers
-- UPDATE doctor_schedule_config SET buffer_minutes = 5 WHERE doctor_id = 1;
-- UPDATE doctor_schedule_config SET buffer_minutes = 10 WHERE doctor_id = 2;
-- UPDATE doctor_schedule_config SET buffer_minutes = 15 WHERE doctor_id = 3;

-- ============================================================================
-- FASE 2: FUNCIÓN PL/pgSQL - Bloquear slots de buffer
-- ============================================================================

CREATE OR REPLACE FUNCTION block_adjacent_slots_for_buffer(
    p_booked_slot_id INT,
    p_doctor_id INT,
    p_buffer_minutes INT
) RETURNS TABLE (
    blocked_slot_id INT,
    blocked_start_time TIMESTAMP,
    blocked_end_time TIMESTAMP,
    block_reason VARCHAR(50)
) AS $$
DECLARE
    v_booked_start TIMESTAMP;
    v_booked_end TIMESTAMP;
    v_buffer_start TIMESTAMP;
    v_buffer_end TIMESTAMP;
    v_slot_date DATE;
BEGIN
    -- 1. Obtener info del slot reservado
    SELECT start_time, end_time, DATE(start_time)
    INTO v_booked_start, v_booked_end, v_slot_date
    FROM time_slots
    WHERE id = p_booked_slot_id AND doctor_id = p_doctor_id;
    
    IF v_booked_start IS NULL THEN
        RAISE EXCEPTION 'Slot not found: %', p_booked_slot_id;
    END IF;
    
    -- 2. Calcular rango de buffer
    -- Buffer anterior: [booked_start - buffer_minutes, booked_start)
    -- Buffer posterior: [booked_end, booked_end + buffer_minutes)
    v_buffer_start := v_booked_start - (p_buffer_minutes || ' minutes')::INTERVAL;
    v_buffer_end := v_booked_end + (p_buffer_minutes || ' minutes')::INTERVAL;
    
    -- 3. Bloquear slots ANTERIORES (entre buffer_start y booked_start)
    UPDATE time_slots
    SET status = 'blocked'
    WHERE doctor_id = p_doctor_id
      AND start_time >= v_buffer_start
      AND start_time < v_booked_start
      AND status = 'available'
      AND DATE(start_time) = v_slot_date
    RETURNING id, start_time, end_time INTO blocked_slot_id, blocked_start_time, blocked_end_time;
    
    block_reason := 'buffer_before';
    RETURN NEXT;
    
    -- 4. Bloquear slots POSTERIORES (entre booked_end y buffer_end)
    UPDATE time_slots
    SET status = 'blocked'
    WHERE doctor_id = p_doctor_id
      AND start_time >= v_booked_end
      AND start_time < v_buffer_end
      AND status = 'available'
      AND DATE(start_time) = v_slot_date
    RETURNING id, start_time, end_time INTO blocked_slot_id, blocked_start_time, blocked_end_time;
    
    block_reason := 'buffer_after';
    RETURN NEXT;
    
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FASE 3: FUNCIÓN - Liberar slots de buffer (al cancelar)
-- ============================================================================

CREATE OR REPLACE FUNCTION unblock_adjacent_slots_for_buffer(
    p_released_slot_id INT,
    p_doctor_id INT,
    p_buffer_minutes INT
) RETURNS TABLE (
    unblocked_slot_id INT,
    unblocked_start_time TIMESTAMP,
    unblocked_end_time TIMESTAMP
) AS $$
DECLARE
    v_released_start TIMESTAMP;
    v_released_end TIMESTAMP;
    v_buffer_start TIMESTAMP;
    v_buffer_end TIMESTAMP;
    v_slot_date DATE;
    v_other_booked_count INT;
BEGIN
    -- 1. Obtener info del slot liberado
    SELECT start_time, end_time, DATE(start_time)
    INTO v_released_start, v_released_end, v_slot_date
    FROM time_slots
    WHERE id = p_released_slot_id AND doctor_id = p_doctor_id;
    
    -- 2. Calcular rango de buffer
    v_buffer_start := v_released_start - (p_buffer_minutes || ' minutes')::INTERVAL;
    v_buffer_end := v_released_end + (p_buffer_minutes || ' minutes')::INTERVAL;
    
    -- 3. Liberar slots anteriores SOLO si no hay otra cita que lo use
    UPDATE time_slots
    SET status = 'available'
    WHERE doctor_id = p_doctor_id
      AND start_time >= v_buffer_start
      AND start_time < v_released_start
      AND status = 'blocked'
      AND DATE(start_time) = v_slot_date
      AND NOT EXISTS (
          -- Verificar que no hay otra cita con buffer que use este slot
          SELECT 1 FROM time_slots ts2
          WHERE ts2.doctor_id = p_doctor_id
            AND ts2.status = 'booked'
            AND DATE(ts2.start_time) = v_slot_date
            AND ts2.start_time - (p_buffer_minutes || ' minutes')::INTERVAL < end_time
            AND ts2.start_time > start_time
      )
    RETURNING id, start_time, end_time INTO unblocked_slot_id, unblocked_start_time, unblocked_end_time;
    RETURN NEXT;
    
    -- 4. Liberar slots posteriores (similar lógica)
    UPDATE time_slots
    SET status = 'available'
    WHERE doctor_id = p_doctor_id
      AND start_time >= v_released_end
      AND start_time < v_buffer_end
      AND status = 'blocked'
      AND DATE(start_time) = v_slot_date
      AND NOT EXISTS (
          SELECT 1 FROM time_slots ts2
          WHERE ts2.doctor_id = p_doctor_id
            AND ts2.status = 'booked'
            AND DATE(ts2.start_time) = v_slot_date
            AND ts2.end_time + (p_buffer_minutes || ' minutes')::INTERVAL > start_time
            AND ts2.end_time < end_time
      )
    RETURNING id, start_time, end_time INTO unblocked_slot_id, unblocked_start_time, unblocked_end_time;
    RETURN NEXT;
    
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FASE 4: BOOKINGS CON BUFFERS (Nueva versión de book_slot_atomic)
-- ============================================================================

CREATE OR REPLACE FUNCTION book_slot_with_buffer(
    p_slot_id INTEGER,
    p_patient_id INTEGER,
    p_buffer_minutes INT DEFAULT 0
) RETURNS TABLE (
    success BOOLEAN,
    appointment_id INTEGER,
    slots_blocked INT,
    error_message TEXT
) AS $$
DECLARE
    v_slot_doctor_id INT;
    v_appointment_id INT;
    v_blocked_count INT := 0;
BEGIN
    -- Step 1: Get slot info
    SELECT doctor_id INTO v_slot_doctor_id
    FROM time_slots
    WHERE id = p_slot_id AND status = 'available'
    FOR UPDATE;
    
    IF v_slot_doctor_id IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::INT, 0, 'Slot not available or already booked';
        RETURN;
    END IF;
    
    -- Step 2: Update slot status to 'booked'
    UPDATE time_slots
    SET status = 'booked'
    WHERE id = p_slot_id;
    
    -- Step 3: Create appointment
    INSERT INTO appointments (slot_id, patient_id, status)
    VALUES (p_slot_id, p_patient_id, 'scheduled')
    RETURNING appointments.id INTO v_appointment_id;
    
    -- Step 4: Block adjacent slots (buffer)
    IF p_buffer_minutes > 0 THEN
        SELECT COUNT(*)::INT INTO v_blocked_count
        FROM block_adjacent_slots_for_buffer(
            p_slot_id,
            v_slot_doctor_id,
            p_buffer_minutes
        );
    END IF;
    
    RETURN QUERY SELECT TRUE, v_appointment_id, v_blocked_count, NULL;
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, NULL::INT, 0, SQLERRM;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FASE 5: CANCELACIÓN CON LIBERACIÓN DE BUFFERS
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_appointment_with_buffer_release(
    p_appointment_id INTEGER,
    p_buffer_minutes INT DEFAULT 0
) RETURNS TABLE (
    success BOOLEAN,
    slot_id INT,
    slots_unblocked INT,
    error_message TEXT
) AS $$
DECLARE
    v_slot_id INT;
    v_doctor_id INT;
    v_prev_status VARCHAR(20);
    v_unblocked_count INT := 0;
BEGIN
    -- Step 1: Get appointment & slot info
    SELECT a.slot_id, ts.doctor_id, ts.status
    INTO v_slot_id, v_doctor_id, v_prev_status
    FROM appointments a
    JOIN time_slots ts ON a.slot_id = ts.id
    WHERE a.id = p_appointment_id
    FOR UPDATE;
    
    IF v_slot_id IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::INT, 0, 'Appointment not found';
        RETURN;
    END IF;
    
    IF v_prev_status != 'booked' THEN
        RETURN QUERY SELECT FALSE, v_slot_id, 0, 'Slot not in booked status';
        RETURN;
    END IF;
    
    -- Step 2: Update appointment status
    UPDATE appointments
    SET status = 'cancelled'
    WHERE id = p_appointment_id;
    
    -- Step 3: Release main slot
    UPDATE time_slots
    SET status = 'available'
    WHERE id = v_slot_id;
    
    -- Step 4: Unblock buffer slots (if configured)
    IF p_buffer_minutes > 0 THEN
        SELECT COUNT(*)::INT INTO v_unblocked_count
        FROM unblock_adjacent_slots_for_buffer(
            v_slot_id,
            v_doctor_id,
            p_buffer_minutes
        );
    END IF;
    
    RETURN QUERY SELECT TRUE, v_slot_id, v_unblocked_count, NULL;
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, NULL::INT, 0, SQLERRM;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FASE 6: QUERIES ÚTILES - Análisis de buffers
-- ============================================================================

-- 6A. Slots disponibles considerando buffers
CREATE OR REPLACE FUNCTION get_available_slots_with_buffer(
    p_doctor_id INT,
    p_date DATE,
    p_exclude_buffers BOOLEAN DEFAULT TRUE
) RETURNS TABLE (
    slot_id INT,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    is_buffer_affected BOOLEAN,
    status_info VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ts.id,
        ts.start_time,
        ts.end_time,
        CASE 
            -- Si está bloqueado y p_exclude_buffers=true, es un buffer
            WHEN ts.status = 'blocked' AND p_exclude_buffers THEN TRUE
            ELSE FALSE
        END as is_buffer_affected,
        ts.status as status_info
    FROM time_slots ts
    WHERE ts.doctor_id = p_doctor_id
      AND DATE(ts.start_time) = p_date
      AND (ts.status = 'available' OR (ts.status = 'blocked' AND NOT p_exclude_buffers))
    ORDER BY ts.start_time;
END;
$$ LANGUAGE plpgsql;


-- 6B. Impacto de buffers en disponibilidad
CREATE OR REPLACE FUNCTION analyze_buffer_impact(
    p_doctor_id INT,
    p_date DATE
) RETURNS TABLE (
    total_slots INT,
    available_slots INT,
    blocked_buffer_slots INT,
    booked_slots INT,
    impact_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INT as total_slots,
        COUNT(CASE WHEN status = 'available' THEN 1 END)::INT as available_slots,
        COUNT(CASE WHEN status = 'blocked' THEN 1 END)::INT as blocked_buffer_slots,
        COUNT(CASE WHEN status = 'booked' THEN 1 END)::INT as booked_slots,
        ROUND(
            COUNT(CASE WHEN status = 'blocked' THEN 1 END)::NUMERIC / 
            COUNT(*)::NUMERIC * 100, 2
        ) as impact_percentage
    FROM time_slots
    WHERE doctor_id = p_doctor_id
      AND DATE(start_time) = p_date;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FASE 7: EDGE CASES - Queries de validación
-- ============================================================================

-- 7A. Detectar buffers solapados (conflictos)
SELECT 
    'overbooking_check' as check_name,
    COUNT(*) as conflict_count
FROM time_slots ts1
WHERE ts1.status = 'blocked'
  AND EXISTS (
      -- Verificar que el buffer NO bloquea slots con otras citas
      SELECT 1 FROM time_slots ts2
      WHERE ts2.doctor_id = ts1.doctor_id
        AND ts2.status = 'booked'
        AND DATE(ts2.start_time) = DATE(ts1.start_time)
        AND NOT (ts1.end_time <= ts2.start_time OR ts1.start_time >= ts2.end_time)
  );

-- 7B. Validar integridad de buffers
SELECT 
    'buffer_integrity' as check_name,
    COUNT(*) as invalid_buffers
FROM time_slots ts
WHERE ts.status = 'blocked'
  AND NOT EXISTS (
      -- Debe haber al menos UNA cita dentro del rango esperado
      SELECT 1 FROM time_slots ts2
      WHERE ts2.doctor_id = ts.doctor_id
        AND ts2.status = 'booked'
        AND DATE(ts2.start_time) = DATE(ts.start_time)
  );


-- ============================================================================
-- FASE 8: EJEMPLO DE USO
-- ============================================================================

/*

-- SETUP:
-- 1. Configurar buffer para doctor 1
UPDATE doctor_schedule_config 
SET buffer_minutes = 10 
WHERE doctor_id = 1;

-- 2. Generar slots de 30 min
INSERT INTO time_slots (doctor_id, start_time, end_time, status, created_at)
VALUES
    (1, '2026-04-05 09:00:00', '2026-04-05 09:30:00', 'available', NOW()),
    (1, '2026-04-05 09:30:00', '2026-04-05 10:00:00', 'available', NOW()),
    (1, '2026-04-05 10:00:00', '2026-04-05 10:30:00', 'available', NOW()),
    (1, '2026-04-05 10:30:00', '2026-04-05 11:00:00', 'available', NOW()),
    (1, '2026-04-05 11:00:00', '2026-04-05 11:30:00', 'available', NOW());

-- 3. Reservar slot 10:00-10:30 CON BUFFER 10 min
SELECT * FROM book_slot_with_buffer(
    p_slot_id := 3,        -- 10:00-10:30
    p_patient_id := 100,
    p_buffer_minutes := 10  -- Buffer 10 minutos
);

-- RESULTADO:
-- Slot reservado: 10:00-10:30 (status='booked')
-- Buffer anterior: 09:50-10:00 → 09:30-10:00 bloqueado (slot 2)
-- Buffer posterior: 10:30-10:40 → 10:30-11:00 bloqueado (slot 4)

-- 4. Consultar disponibles (excluye buffers)
SELECT * FROM get_available_slots_with_buffer(
    p_doctor_id := 1,
    p_date := '2026-04-05'::DATE,
    p_exclude_buffers := TRUE
);
-- Resultado: Slots 1 (09:00-09:30) y 5 (11:00-11:30) disponibles

-- 5. Analizar impacto de buffers
SELECT * FROM analyze_buffer_impact(1, '2026-04-05'::DATE);

-- 6. Cancelar cita (libera buffers)
SELECT * FROM cancel_appointment_with_buffer_release(
    p_appointment_id := 1,
    p_buffer_minutes := 10
);
-- Resultado: Slots 2 y 4 vuelven a estado 'available'

*/
