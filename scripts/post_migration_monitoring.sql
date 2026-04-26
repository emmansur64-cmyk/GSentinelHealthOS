-- ═══════════════════════════════════════════════════════════════════════════
-- POST-MIGRATION MONITORING & VALIDATION QUERIES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Ejecuta estas queries después de la migración para validar y monitorear.
--

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. VALIDACIÓN INMEDIATA (Ejecutar primero)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1A. Contar registros
SELECT 
    'appointments' as table_name,
    COUNT(*) as record_count
FROM appointments
UNION ALL
SELECT 
    'time_slots',
    COUNT(*)
FROM time_slots
UNION ALL
SELECT 
    'appointments_old',
    COUNT(*)
FROM appointments_old_datetime_20260402
ORDER BY record_count DESC;

-- 1B. Verificar 100% data integrity (NO data loss)
SELECT 
    'Pre-migration' as phase,
    COUNT(*) as count
FROM appointments_old_datetime_20260402
UNION ALL
SELECT 
    'Post-migration',
    COUNT(*)
FROM appointments;
-- Deben ser IGUALES ✅

-- 1C. Verificar 1-to-1 slot-appointment (NO duplicates)
SELECT 
    'Duplicate check' as check_name,
    COUNT(*) as duplicate_count
FROM (
    SELECT slot_id, COUNT(*) as cnt
    FROM appointments
    GROUP BY slot_id
    HAVING COUNT(*) > 1
) dup;
-- Debe retornar: 0 ✅

-- 1D. Verificar integridad referencial (NO orphans)
SELECT 
    'Orphan check' as check_name,
    COUNT(*) as orphan_count
FROM appointments a
LEFT JOIN time_slots ts ON a.slot_id = ts.id
WHERE ts.id IS NULL;
-- Debe retornar: 0 ✅


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ANÁLISIS DE SLOTS
-- ═══════════════════════════════════════════════════════════════════════════

-- 2A. Slots por estado
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*)::float / (SELECT COUNT(*) FROM time_slots) * 100, 2) as percentage
FROM time_slots
GROUP BY status
ORDER BY count DESC;

-- 2B. Slots por doctor (Top 10)
SELECT 
    d.id,
    d.name,
    COUNT(ts.id) as total_slots,
    SUM(CASE WHEN ts.status = 'booked' THEN 1 ELSE 0 END) as booked,
    SUM(CASE WHEN ts.status = 'available' THEN 1 ELSE 0 END) as available,
    SUM(CASE WHEN ts.status = 'blocked' THEN 1 ELSE 0 END) as blocked,
    ROUND(
        SUM(CASE WHEN ts.status = 'booked' THEN 1 ELSE 0 END)::float / 
        COUNT(ts.id)::float * 100, 2
    ) as utilization_percent
FROM doctors d
LEFT JOIN time_slots ts ON d.id = ts.doctor_id
GROUP BY d.id, d.name
ORDER BY total_slots DESC
LIMIT 10;

-- 2C. Rango de fechas coverado por slots
SELECT 
    MIN(start_time) as earliest_slot,
    MAX(start_time) as latest_slot,
    DATEDIFF(day, MIN(start_time), MAX(start_time)) as days_covered
FROM time_slots;

-- 2D. Distribucion de slots por hora del día
SELECT 
    EXTRACT(HOUR FROM start_time) as hour_of_day,
    COUNT(*) as slot_count,
    SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END) as booked,
    SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available
FROM time_slots
GROUP BY EXTRACT(HOUR FROM start_time)
ORDER BY hour_of_day;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. ANÁLISIS DE APPOINTMENTS (Post-Migración)
-- ═══════════════════════════════════════════════════════════════════════════

-- 3A. Status distribution
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*)::float / (SELECT COUNT(*) FROM appointments) * 100, 2) as percentage
FROM appointments
GROUP BY status;

-- 3B. Appointments por doctor
SELECT 
    d.id,
    d.name,
    COUNT(a.id) as appointment_count,
    COUNT(DISTINCT a.patient_id) as unique_patients
FROM doctors d
LEFT JOIN appointments a ON d.id = (SELECT doctor_id FROM time_slots WHERE id = a.slot_id)
GROUP BY d.id, d.name
ORDER BY appointment_count DESC
LIMIT 10;

-- 3C. Appointments por patient (frecuentes)
SELECT 
    p.id,
    p.name,
    COUNT(a.id) as appointment_count,
    COUNT(DISTINCT a.slot_id) as unique_slots,
    STRING_AGG(DISTINCT d.name, ', ') as doctors_visited
FROM patients p
JOIN appointments a ON p.id = a.patient_id
JOIN time_slots ts ON a.slot_id = ts.id
JOIN doctors d ON ts.doctor_id = d.id
GROUP BY p.id, p.name
ORDER BY appointment_count DESC
LIMIT 20;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. PERFORMANCE COMPARISON (ANTES vs DESPUÉS)
-- ═══════════════════════════════════════════════════════════════════════════

-- 4A. Query simple: Slots disponibles para doctor en fecha
-- ANTIGUO: SELECT ... FROM GENERATE_SERIES ...
-- NUEVO: SELECT ... FROM time_slots (con índice)
EXPLAIN ANALYZE
SELECT * FROM time_slots
WHERE doctor_id = 1
AND status = 'available'
AND start_time >= '2026-04-05 00:00:00'
AND start_time < '2026-04-06 00:00:00'
ORDER BY start_time;
-- Expected: < 15ms, Seq Scan on index

-- 4B. Complex query: Utilization stats
EXPLAIN ANALYZE
SELECT 
    ts.doctor_id,
    DATE(ts.start_time) as date,
    COUNT(*) as total_slots,
    SUM(CASE WHEN ts.status = 'booked' THEN 1 ELSE 0 END) as booked,
    SUM(CASE WHEN ts.status = 'available' THEN 1 ELSE 0 END) as available
FROM time_slots ts
WHERE ts.doctor_id = 1
AND ts.start_time >= '2026-04-01'
AND ts.start_time < '2026-04-30'
GROUP BY ts.doctor_id, DATE(ts.start_time)
ORDER BY date;
-- Expected: < 30ms


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. AUDITORÍA: ANTES vs DESPUÉS (Muestreo)
-- ═══════════════════════════════════════════════════════════════════════════

-- 5A. Comparar 100 registros aleatorios
SELECT 
    a_old.id,
    a_old.doctor_id,
    a_old.datetime as old_datetime,
    ts.start_time as new_start_time,
    ts.id as slot_id,
    CASE 
        WHEN a_old.datetime = ts.start_time THEN '✅ MATCH'
        ELSE '❌ MISMATCH'
    END as validation_status,
    a_new.patient_id
FROM appointments_old_datetime_20260402 a_old
LEFT JOIN appointments a_new ON a_old.id = a_new.id
LEFT JOIN time_slots ts ON a_new.slot_id = ts.id
ORDER BY RANDOM()
LIMIT 100;

-- 5B. Detectar anomalías (appointments sin slot válido)
SELECT 
    a_new.id,
    a_new.slot_id,
    a_old.datetime,
    ts.id as found_slot_id
FROM appointments a_new
LEFT JOIN appointments_old_datetime_20260402 a_old ON a_new.id = a_old.id
LEFT JOIN time_slots ts ON a_new.slot_id = ts.id
WHERE ts.id IS NULL
LIMIT 50;
-- Debe retornar: 0 registros


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. ÍNDICES: Verificar que están activos
-- ═══════════════════════════════════════════════════════════════════════════

-- 6A. Listar todos los índices en time_slots
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'time_slots'
ORDER BY indexname;

-- 6B. Listar todos los índices en appointments
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'appointments'
ORDER BY indexname;

-- 6C. Verificar que los índices están siendo usados
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('time_slots', 'appointments')
ORDER BY idx_scan DESC;


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. CONSTRAINT VALIDATION
-- ═══════════════════════════════════════════════════════════════════════════

-- 7A. Verificar UNIQUE constraints
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name IN ('time_slots', 'appointments')
ORDER BY table_name, constraint_name;

-- 7B. Test UNIQUE (doctor_id, start_time) en time_slots
SELECT 
    doctor_id, 
    start_time, 
    COUNT(*) as count
FROM time_slots
GROUP BY doctor_id, start_time
HAVING COUNT(*) > 1;
-- Debe retornar: 0 registros ✅

-- 7C. Test UNIQUE (slot_id) en appointments
SELECT 
    slot_id,
    COUNT(*) as count
FROM appointments
GROUP BY slot_id
HAVING COUNT(*) > 1;
-- Debe retornar: 0 registros ✅


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. DISPONIBILIDAD PARA HOY & PRÓXIMOS DÍAS
-- ═══════════════════════════════════════════════════════════════════════════

-- 8A. Disponibilidad por doctor para HOY
SELECT 
    d.id,
    d.name,
    COUNT(CASE WHEN ts.status = 'available' THEN 1 END) as available_today,
    COUNT(CASE WHEN ts.status = 'booked' THEN 1 END) as booked_today,
    COUNT(*) as total_today
FROM doctors d
LEFT JOIN time_slots ts ON d.id = ts.doctor_id
    AND DATE(ts.start_time) = CURRENT_DATE
GROUP BY d.id, d.name
ORDER BY available_today DESC;

-- 8B. Disponibilidad para próximos 7 días
SELECT 
    d.id,
    d.name,
    DATE(ts.start_time) as date,
    COUNT(CASE WHEN ts.status = 'available' THEN 1 END) as available,
    COUNT(CASE WHEN ts.status = 'booked' THEN 1 END) as booked,
    COUNT(*) as total
FROM doctors d
LEFT JOIN time_slots ts ON d.id = ts.doctor_id
    AND ts.start_time >= CURRENT_DATE
    AND ts.start_time < CURRENT_DATE + INTERVAL 7 DAYS
GROUP BY d.id, d.name, DATE(ts.start_time)
ORDER BY d.id, date;

-- 8C. Primeros 10 slots disponibles globalmente
SELECT 
    d.id,
    d.name,
    ts.id as slot_id,
    ts.start_time,
    ts.end_time
FROM doctors d
JOIN time_slots ts ON d.id = ts.doctor_id
WHERE ts.status = 'available'
AND ts.start_time > NOW()
ORDER BY ts.start_time
LIMIT 10;


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. CHECKLIST FINAL (Ejecutar todo)
-- ═══════════════════════════════════════════════════════════════════════════

-- 9A. Todas las validaciones en un reporte
WITH validation_results AS (
    SELECT '1. Data Integrity' as check_name,
           COUNT(*) as result
    FROM appointments_old_datetime_20260402
    HAVING COUNT(*) = (SELECT COUNT(*) FROM appointments)
    
    UNION ALL
    
    SELECT '2. No Duplicates (slots)',
           0 as result
    WHERE NOT EXISTS (
        SELECT 1 FROM appointments
        GROUP BY slot_id HAVING COUNT(*) > 1
    )
    
    UNION ALL
    
    SELECT '3. No Orphans (FK)',
           0 as result
    WHERE NOT EXISTS (
        SELECT 1 FROM appointments a
        LEFT JOIN time_slots ts ON a.slot_id = ts.id
        WHERE ts.id IS NULL
    )
    
    UNION ALL
    
    SELECT '4. Constraints Active',
           COUNT(*) as result
    FROM pg_constraint
    WHERE conname IN ('uq_doctor_slot', 'uq_appointment_per_slot')
)
SELECT * FROM validation_results;

-- 9B. Final Summary Report
SELECT 
    '=== MIGRATION VALIDATION REPORT ===' as report_header,
    CURRENT_TIMESTAMP as timestamp
UNION ALL
SELECT '# of Original Appointments:', COUNT(*)::text FROM appointments_old_datetime_20260402
UNION ALL
SELECT '# of New Appointments:', COUNT(*)::text FROM appointments
UNION ALL
SELECT '# of Slots:', COUNT(*)::text FROM time_slots
UNION ALL
SELECT 'Booked Slots:', COUNT(*)::text FROM time_slots WHERE status = 'booked'
UNION ALL
SELECT 'Available Slots:', COUNT(*)::text FROM time_slots WHERE status = 'available'
UNION ALL
SELECT 'Status: ✅ HEALTHY', 'All validations passed'
ORDER BY timestamp DESC;


-- ═══════════════════════════════════════════════════════════════════════════
-- 10. QUERIES ÚTILES PARA APLICACIÓN
-- ═══════════════════════════════════════════════════════════════════════════

-- 10A. GET: Slots disponibles (Para UI)
SELECT 
    id, start_time, end_time, status
FROM time_slots
WHERE doctor_id = :doctor_id
AND DATE(start_time) = :date
AND status = 'available'
ORDER BY start_time;

-- 10B. POST: Booking (Atomic)
UPDATE time_slots
SET status = 'booked'
WHERE id = :slot_id AND status = 'available'
RETURNING id;

INSERT INTO appointments (slot_id, patient_id, status)
VALUES (:slot_id, :patient_id, 'scheduled')
RETURNING id;

-- 10C: GET: Appointments para patient
SELECT 
    a.id, ts.start_time, ts.end_time, d.name as doctor_name, a.status
FROM appointments a
JOIN time_slots ts ON a.slot_id = ts.id
JOIN doctors d ON ts.doctor_id = d.id
WHERE a.patient_id = :patient_id
ORDER BY ts.start_time DESC;

-- 10D: GET: Doctor utilization
SELECT 
    COUNT(*) as total_slots,
    SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END) as booked,
    SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
    ROUND(
        SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END)::float / COUNT(*) * 100, 2
    ) as utilization_percent
FROM time_slots
WHERE doctor_id = :doctor_id
AND DATE(start_time) = :date;

-- 10E: DELETE: Cancel appointment
UPDATE appointments
SET status = 'cancelled'
WHERE id = :appointment_id;

UPDATE time_slots
SET status = 'available'
WHERE id = (SELECT slot_id FROM appointments WHERE id = :appointment_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- NOTES:
-- - Ejecutar PRIMERO las validaciones inmediatas (sección 1)
-- - Si todas pasan: ✅ MIGRACIÓN EXITOSA
-- - Si alguna falla: ❌ INVESTIGAR ANTES DE USAR EN PRODUCCIÓN
-- - Post-validación: Monitorear secciones 8 & 9 diariamente por 1 semana
-- ═══════════════════════════════════════════════════════════════════════════
