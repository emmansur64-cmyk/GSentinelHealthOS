/**
 * MIGRACIÓN: DateTime → Slots
 * 
 * Estrategia sin pérdida de datos:
 * 1. Crear time_slots desde appointments existentes
 * 2. Crear appointments_migrated con slot_id
 * 3. Validar integridad
 * 4. Cutover (renombrar tablas)
 * 5. Rollback plan si es necesario
 * 
 * Ejecución segura: Pode pausar en cualquier punto
 */

-- ============================================================================
-- FASE 0: BACKUP (Recomendado antes de iniciar)
-- ============================================================================

-- Crear tabla de backup de appointments actuales
CREATE TABLE IF NOT EXISTS appointments_backup_20260402 AS
SELECT * FROM appointments;

-- Verificar backup
-- SELECT COUNT(*) FROM appointments_backup_20260402;


-- ============================================================================
-- FASE 1: CREAR TABLE time_slots (si no existe)
-- ============================================================================

CREATE TABLE IF NOT EXISTS time_slots (
    id SERIAL PRIMARY KEY,
    doctor_id INT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraint: Un solo slot por doctor por horario
    CONSTRAINT uq_doctor_slot UNIQUE (doctor_id, start_time),
    
    -- Foreign key
    CONSTRAINT fk_slots_doctor FOREIGN KEY (doctor_id) 
        REFERENCES doctors(id) ON DELETE CASCADE,
    
    -- Validación
    CONSTRAINT ck_start_before_end CHECK (start_time < end_time)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_slots_doctor_status 
    ON time_slots(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_slots_doctor_time 
    ON time_slots(doctor_id, start_time);

PRINT('✅ Table time_slots creada');


-- ============================================================================
-- FASE 2: GENERAR SLOTS HISTÓRICOS
-- ============================================================================

-- 2A. Generar slots basados en appointments existentes
-- IMPORTANTE: Cada appointment genera UN slot exacto
INSERT INTO time_slots (doctor_id, start_time, end_time, status, created_at)
SELECT DISTINCT
    appointments.doctor_id,
    appointments.datetime AS start_time,
    -- Asumir duración de 30 minutos si no existe campo end_time
    appointments.datetime + INTERVAL '30 minutes' AS end_time,
    'booked' AS status,
    appointments.created_at
FROM appointments
ON CONFLICT (doctor_id, start_time) DO NOTHING;

-- Verificar slots creados
-- SELECT COUNT(*) FROM time_slots;

PRINT('✅ Slots históricos generados desde appointments');


-- ============================================================================
-- FASE 3: CREAR TABLA appointments_new CON slot_id
-- ============================================================================

-- 3A. Crear nueva tabla con estructura migrada
CREATE TABLE IF NOT EXISTS appointments_new (
    id INT NOT NULL,                    -- Preservar ID original
    slot_id INT NOT NULL,               -- NUEVO: Link a slot
    patient_id INT NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled',
    created_at TIMESTAMP,
    
    PRIMARY KEY (id),
    
    -- Constraint CRÍTICO: 1-to-1 slot
    CONSTRAINT uq_appointment_per_slot UNIQUE (slot_id),
    
    -- Foreign keys
    CONSTRAINT fk_appt_new_slot FOREIGN KEY (slot_id) 
        REFERENCES time_slots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_appt_new_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE CASCADE
);

PRINT('✅ Tabla appointments_new creada');


-- ============================================================================
-- FASE 4: MIGRAR DATOS (appointments → appointments_new + slot_id)
-- ============================================================================

-- 4A. Mapear cada appointment a su slot correspondiente
INSERT INTO appointments_new (id, slot_id, patient_id, status, created_at)
SELECT 
    a.id,
    ts.id AS slot_id,
    a.patient_id,
    'scheduled' AS status,
    a.created_at
FROM appointments a
INNER JOIN time_slots ts ON 
    ts.doctor_id = a.doctor_id
    AND ts.start_time = a.datetime
WHERE ts.status = 'booked'
ON CONFLICT (id) DO NOTHING;

PRINT('✅ Datos migrados a appointments_new con slot_id');


-- ============================================================================
-- FASE 5: VALIDACIÓN SIN PÉRDIDA DE DATOS
-- ============================================================================

-- 5A. Contar registros antes/después
SELECT 
    (SELECT COUNT(*) FROM appointments) AS original_count,
    (SELECT COUNT(*) FROM appointments_new) AS migrated_count;

-- 5B. Validar que TODOS los appointments fueron migrados
-- (Si hay diferencia, hay problema)
DO $$
DECLARE
    v_original_count INT;
    v_migrated_count INT;
BEGIN
    SELECT COUNT(*) INTO v_original_count FROM appointments;
    SELECT COUNT(*) INTO v_migrated_count FROM appointments_new;
    
    IF v_original_count = v_migrated_count THEN
        RAISE NOTICE '✅ VALIDACIÓN OK: %d registros migrados sin pérdida', v_original_count;
    ELSE
        RAISE EXCEPTION '❌ ERROR: Pérdida de datos! Original: %, Migrado: %', 
            v_original_count, v_migrated_count;
    END IF;
END $$;

-- 5C. Validar integridad de slots
SELECT 
    'Slots booked' AS metric,
    COUNT(*) AS count
FROM time_slots
WHERE status = 'booked'
UNION ALL
SELECT 
    'Appointments assigned',
    COUNT(*)
FROM appointments_new;

-- 5D. Validar que cada appointment tiene exactamente 1 slot
SELECT 
    'Appointment con 0 slots' AS error_type,
    COUNT(*) AS count
FROM appointments_new
WHERE slot_id IS NULL
UNION ALL
SELECT 
    'Appointments con múltiples slots',
    COUNT(*)
FROM (
    SELECT slot_id, COUNT(*) as cnt
    FROM appointments_new
    GROUP BY slot_id
    HAVING COUNT(*) > 1
) AS duplicates;

PRINT('✅ Validaciones completadas');


-- ============================================================================
-- FASE 6: VERIFICACIÓN FINAL (CHECKLISTS)
-- ============================================================================

-- 6A. Mostrar ejemplo de migración
SELECT 
    a.id,
    a.doctor_id,
    'appointments' AS table_origin,
    a.patient_id,
    ts.id AS slot_id,
    ts.start_time,
    ts.end_time,
    ts.status
FROM appointments_new a
JOIN time_slots ts ON a.slot_id = ts.id
LIMIT 10;

-- 6B. Integridad referencial
SELECT 
    COUNT(*) as appointments_without_valid_slot
FROM appointments_new a
LEFT JOIN time_slots ts ON a.slot_id = ts.id
WHERE ts.id IS NULL;

PRINT('✅ Sistema de migración validado');


-- ============================================================================
-- FASE 7: CUTOVER (EJECUTAR AL FINAL)
-- ============================================================================

-- ⚠️ SOLO EJECUTAR CUANDO TODAS LAS VALIDACIONES PASAN ⚠️

-- 7A. Cambiar nombre de tabla antigua
-- ALTER TABLE appointments RENAME TO appointments_old_datetime_20260402;

-- 7B. Cambiar nombre de tabla nueva
-- ALTER TABLE appointments_new RENAME TO appointments;

-- 7C. Actualizar secuencia de ID si es necesario
-- SELECT MAX(id) FROM appointments;
-- ALTER SEQUENCE appointments_id_seq RESTART WITH [MAX_ID + 1];

PRINT('✅ Script de migración completado - LISTO PARA CUTOVER');


-- ============================================================================
-- PLAN DE ROLLBACK (Si algo falla)
-- ============================================================================

/*
-- Rollback inmediato:
DROP TABLE IF EXISTS appointments_new;
DROP TABLE IF EXISTS time_slots;

-- Recuperar desde backup:
DELETE FROM appointments;
INSERT INTO appointments SELECT * FROM appointments_backup_20260402;

-- Verificar que todo está como antes:
SELECT COUNT(*) FROM appointments;
*/

-- ============================================================================
-- QUERIES ÚTILES POST-MIGRACIÓN
-- ============================================================================

/*

-- Listar slots disponibles para un doctor
SELECT * FROM time_slots 
WHERE doctor_id = 1 
AND status = 'available'
AND start_time >= NOW()
ORDER BY start_time
LIMIT 10;

-- Obtener utilización de un doctor
SELECT 
    doctor_id,
    COUNT(*) as total_slots,
    SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END) as booked_slots,
    SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_slots,
    ROUND(
        SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END)::float / 
        COUNT(*)::float * 100, 2
    ) as utilization_percentage
FROM time_slots
WHERE doctor_id = 1
GROUP BY doctor_id;

-- Auditoría: Comparar appointments anterior vs nuevo
SELECT 
    a_old.id,
    a_old.doctor_id,
    a_old.datetime,
    a_new.slot_id,
    ts.start_time,
    CASE 
        WHEN a_old.datetime = ts.start_time THEN '✅ OK'
        ELSE '❌ MISMATCH'
    END as validation_status
FROM appointments_backup_20260402 a_old
LEFT JOIN appointments_new a_new ON a_old.id = a_new.id
LEFT JOIN time_slots ts ON a_new.slot_id = ts.id
LIMIT 20;

*/
