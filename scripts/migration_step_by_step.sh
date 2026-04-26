#!/bin/bash
#
# SCRIPT: Migración DateTime → Slots (Paso a Paso)
#
# Uso: bash migration_step_by_step.sh
#
# Este script ejecuta la migración en pasos discretos
# permitiendo validar cada fase antes de proceder.
#

set -e

# =============================================================================
# CONFIGURACIÓN
# =============================================================================

DB_NAME="${1:-gsentinel}"
DB_USER="${2:-postgres}"
DB_HOST="${3:-localhost}"
DB_PORT="${4:-5432}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_migration_pre_${TIMESTAMP}.sql"
LOG_FILE="migration_${TIMESTAMP}.log"

echo "==================================================================="
echo "  MIGRATION: DateTime → Slots (Step by Step)"
echo "==================================================================="
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Host: $DB_HOST:$DB_PORT"
echo "Backup: $BACKUP_FILE"
echo "Log: $LOG_FILE"
echo "==================================================================="
echo ""

# =============================================================================
# FUNCIONES HELPER
# =============================================================================

exec_sql() {
    local query="$1"
    local description="$2"
    
    echo "▶ $description"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$query" | tee -a "$LOG_FILE"
    echo ""
}

exec_sql_file() {
    local file="$1"
    local description="$2"
    
    echo "▶ $description (from file: $file)"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file" | tee -a "$LOG_FILE"
    echo ""
}

wait_for_user() {
    local step="$1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✓ Step $step completado"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    read -p "Presiona ENTER para continuar con siguiente step (o CTRL+C para cancelar)..." dummy
    echo ""
}

# =============================================================================
# FASE 0: BACKUP
# =============================================================================

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║ FASE 0: BACKUP Y VERIFICACIÓN                                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

echo "📦 Creando backup pre-migración..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"
echo "✅ Backup guardado: $BACKUP_FILE"
echo ""

exec_sql "SELECT COUNT(*) as total_appointments FROM appointments;" \
    "01A: Verificar appointments actuales"

exec_sql "SELECT MIN(datetime), MAX(datetime) FROM appointments;" \
    "01B: Rango de fechas en appointments"

exec_sql "SELECT doctor_id, COUNT(*) FROM appointments GROUP BY doctor_id ORDER BY count DESC LIMIT 5;" \
    "01C: Top 5 doctores por appointments"

wait_for_user "0: BACKUP"


# =============================================================================
# FASE 1: CREAR TABLA time_slots
# =============================================================================

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║ FASE 1: CREAR TABLA time_slots                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

exec_sql "
CREATE TABLE IF NOT EXISTS time_slots (
    id SERIAL PRIMARY KEY,
    doctor_id INT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT uq_doctor_slot UNIQUE (doctor_id, start_time),
    CONSTRAINT fk_slots_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    CONSTRAINT ck_start_before_end CHECK (start_time < end_time)
);
" "02A: Crear tabla time_slots"

exec_sql "
CREATE INDEX IF NOT EXISTS idx_slots_doctor_status ON time_slots(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_slots_doctor_time ON time_slots(doctor_id, start_time);
" "02B: Crear índices en time_slots"

exec_sql "SELECT COUNT(*) as time_slots_count FROM time_slots;" \
    "02C: Verificar time_slots vacía"

wait_for_user "1: CREAR TABLA"


# =============================================================================
# FASE 2: GENERAR SLOTS DESDE APPOINTMENTS
# =============================================================================

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║ FASE 2: GENERAR SLOTS DESDE APPOINTMENTS                     ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

exec_sql "
INSERT INTO time_slots (doctor_id, start_time, end_time, status, created_at)
SELECT DISTINCT
    a.doctor_id,
    a.datetime AS start_time,
    a.datetime + INTERVAL '30 minutes' AS end_time,
    'booked' AS status,
    a.created_at
FROM appointments a
ON CONFLICT (doctor_id, start_time) DO NOTHING;
" "03A: Insertar slots desde appointments"

exec_sql "SELECT COUNT(*) as slots_generated FROM time_slots;" \
    "03B: Contar slots generados"

exec_sql "SELECT status, COUNT(*) FROM time_slots GROUP BY status;" \
    "03C: Slots por estado"

exec_sql "
SELECT 
    doctor_id,
    COUNT(*) as slots_count,
    MIN(start_time) as earliest,
    MAX(start_time) as latest
FROM time_slots
GROUP BY doctor_id
ORDER BY slots_count DESC
LIMIT 5;
" "03D: Top 5 doctores por slots generados"

wait_for_user "2: GENERAR SLOTS"


# =============================================================================
# FASE 3: CREAR TABLA appointments_new
# =============================================================================

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║ FASE 3: CREAR TABLA appointments_new                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

exec_sql "
CREATE TABLE IF NOT EXISTS appointments_new (
    id INT NOT NULL PRIMARY KEY,
    slot_id INT NOT NULL,
    patient_id INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP,
    
    CONSTRAINT uq_appointment_per_slot UNIQUE (slot_id),
    CONSTRAINT fk_appt_new_slot FOREIGN KEY (slot_id) REFERENCES time_slots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_appt_new_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);
" "04A: Crear tabla appointments_new"

exec_sql "
CREATE INDEX IF NOT EXISTS idx_appointments_new_slot ON appointments_new(slot_id);
CREATE INDEX IF NOT EXISTS idx_appointments_new_patient ON appointments_new(patient_id);
" "04B: Crear índices en appointments_new"

exec_sql "SELECT COUNT(*) as appointments_new_count FROM appointments_new;" \
    "04C: Verificar appointments_new vacía"

wait_for_user "3: CREAR TABLA"


# =============================================================================
# FASE 4: MIGRAR DATOS
# =============================================================================

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║ FASE 4: MIGRAR DATOS (appointments → appointments_new)       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

exec_sql "
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
" "05A: Insertar appointments en appointments_new"

exec_sql "SELECT COUNT(*) as migrated_appointments FROM appointments_new;" \
    "05B: Contar appointments migrados"

exec_sql "SELECT status, COUNT(*) FROM appointments_new GROUP BY status;" \
    "05C: Appointments por estado"

wait_for_user "4: MIGRAR DATOS"


# =============================================================================
# FASE 5: VALIDACIÓN
# =============================================================================

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║ FASE 5: VALIDACIÓN (Sin Pérdida de Datos)                    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

echo "✓ VALIDACIÓN 1: Data Loss Check"
exec_sql "
SELECT 
    (SELECT COUNT(*) FROM appointments) as original_count,
    (SELECT COUNT(*) FROM appointments_new) as migrated_count,
    (SELECT COUNT(*) FROM appointments) - (SELECT COUNT(*) FROM appointments_new) as data_loss;
" "06A: Contar datos"

echo "✓ VALIDACIÓN 2: Integridad 1-to-1 (No duplicados)"
exec_sql "
SELECT COUNT(*) as duplicate_slots
FROM (
    SELECT slot_id, COUNT(*) as cnt
    FROM appointments_new
    GROUP BY slot_id
    HAVING COUNT(*) > 1
) duplicates;
" "06B: Verificar slots duplicados"

echo "✓ VALIDACIÓN 3: Integridad Referencial"
exec_sql "
SELECT COUNT(*) as orphan_appointments
FROM appointments_new a
LEFT JOIN time_slots ts ON a.slot_id = ts.id
WHERE ts.id IS NULL;
" "06C: Verificar appointments huérfanos"

echo "✓ VALIDACIÓN 4: Muestreo (Auditoría)"
exec_sql "
SELECT 
    a_old.id,
    a_old.datetime,
    ts.start_time,
    CASE WHEN a_old.datetime = ts.start_time THEN '✅ OK' ELSE '❌ MISMATCH' END as match
FROM appointments a_old
INNER JOIN appointments_new a_new ON a_old.id = a_new.id
INNER JOIN time_slots ts ON a_new.slot_id = ts.id
LIMIT 20;
" "06D: Muestreo (20 registros)"

wait_for_user "5: VALIDACIÓN"


# =============================================================================
# FASE 6: CUTOVER (PRECAUCIÓN)
# =============================================================================

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║ FASE 6: CUTOVER (Cambio Final - POINT OF NO RETURN)          ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

read -p "⚠️  A punto de ejecutar CUTOVER. Confirma (S/n): " confirm
if [[ ! $confirm =~ ^[Ss]$ ]]; then
    echo "❌ CUTOVER cancelado"
    exit 1
fi

exec_sql "ALTER TABLE appointments RENAME TO appointments_old_datetime_${TIMESTAMP};" \
    "07A: Renombrar appointments antiguo"

exec_sql "ALTER TABLE appointments_new RENAME TO appointments;" \
    "07B: Renombrar appointments_new a appointments"

exec_sql "SELECT COUNT(*) as final_appointments FROM appointments;" \
    "07C: Verificar appointments final"

exec_sql "SELECT MAX(id) FROM appointments;" \
    "07D: Máximo ID en appointments"

wait_for_user "6: CUTOVER"


# =============================================================================
# RESUMEN FINAL
# =============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║ ✅ MIGRACIÓN COMPLETADA                                       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

exec_sql "
SELECT 
    (SELECT COUNT(*) FROM appointments) as total_appointments,
    (SELECT COUNT(*) FROM time_slots) as total_slots,
    (SELECT COUNT(*) FROM time_slots WHERE status = 'booked') as booked_slots,
    (SELECT COUNT(*) FROM time_slots WHERE status = 'available') as available_slots;
" "Final Statistics"

echo ""
echo "📊 Resumen:"
echo "  ✅ Backup: $BACKUP_FILE"
echo "  ✅ Log: $LOG_FILE"
echo "  ✅ Rollback disponible: ALTER TABLE appointments RENAME TO appointments_new"
echo ""
echo "🎯 Próximos pasos:"
echo "  1. Testear aplicación con nuevas queries"
echo "  2. Monitorear performance"
echo "  3. Borrar tabla appointments_old si todo OK"
echo ""
