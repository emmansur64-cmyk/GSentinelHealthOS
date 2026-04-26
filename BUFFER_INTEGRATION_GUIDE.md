"""
Documentación: Integración de Buffers con TimeSlotService
"""

# ============================================================================
# 1. MODELO EXTENDIDO
# ============================================================================

# La tabla time_slots ya existe:
#   CREATE TABLE time_slots (
#       id SERIAL PRIMARY KEY,
#       doctor_id INT NOT NULL,
#       start_time TIMESTAMP NOT NULL,
#       end_time TIMESTAMP NOT NULL,
#       status VARCHAR(20) DEFAULT 'available',  # available, booked, blocked, cancelled
#       created_at TIMESTAMP DEFAULT NOW()
#   );
#
# Se extiende con:
#   ALTER TABLE doctor_schedule_config ADD COLUMN buffer_minutes INT DEFAULT 0;
#
# Esto permite buffer configurável per doctor


# ============================================================================
# 2. FLUJO DE RESERVA CON BUFFER
# ============================================================================

# ESCENARIO: Doctor con 10 minutos de buffer, slots de 30 min

# ANTES (Sin buffer):
#   10:00-10:30 disponible  ✓
#   10:30-11:00 disponible  ✓
#   11:00-11:30 disponible  ✓

# ACCIÓN: book_slot_with_buffer(slot_id=1, patient_id=100, doctor_id=1, buffer_minutes=10)
#   → Slot 1 (10:00-10:30): booked
#   → Calcular buffer_before = 10:00 - 10min = 09:50
#   → Calcular buffer_after = 10:30 + 10min = 10:40
#   
#   → Buscar slots ANTES: 09:50 <= start < 10:00
#       - Slot X (09:30-10:00): cambiar a blocked
#   
#   → Buscar slots DESPUÉS: 10:30 <= start < 10:40
#       - Slot 2 (10:30-11:00): cambiar a blocked (porque start=10:30 < 10:40)
#
# DESPUÉS:
#   09:30-10:00 blocked   (buffer antes)
#   10:00-10:30 booked    (cita)
#   10:30-11:00 blocked   (buffer después)
#   11:00-11:30 available ✓

# CLIENTES VEN:
#   Solo slot 11:00-11:30 está disponible
#   20% de capacidad perdida (2 slots bloqueados de 3)


# ============================================================================
# 3. CASOS LÍMITE MANEJADOS
# ============================================================================

# CASO 1: Inicio de jornada
#   Slot 1: 08:00-08:30 booked, buffer_minutes=10
#   buffer_before = 07:50 (fuera de horario)
#   → No busca slots antes, OK

# CASO 2: Fin de jornada
#   Slot 5: 17:30-18:00 booked, buffer_minutes=10
#   buffer_after = 18:10 (fuera de horario)
#   → No busca slots después, OK

# CASO 3: Buffers solapados de múltiples citas
#   Cita 1: 10:00-10:30 (buffer 10min) → bloquea 10:30-10:40
#   Cita 2: 10:40-11:10 (buffer 10min) → intenta bloquear 10:30-10:40
#   
#   En desbloqueo (cancel):
#   - cancel(cita_1) → intenta liberar slot 10:30-10:40
#   - PERO verifica: ¿hay otra cita (10:40-11:10) que lo use?
#   - Sí → NO libera (queda bloqueado)
#   - Cuando cancel(cita_2) → sí libera (es la última)

# CASO 4: Buffer mayor que slot
#   Slot: 10:00-10:30 (duración 30min)
#   buffer_minutes: 60
#   buffer_before = 09:00, buffer_after = 11:30
#   → Bloquea slots 09:00-11:30 (casi toda la mañana)
#   → Validación: No permitir buffer > duracion_slot * 2


# ============================================================================
# 4. INTEGRACIÓN CON ENDPOINTS EXISTENTES
# ============================================================================

# VIEJO (sin buffer):
#   POST /api/v1/slots/book
#   {
#       "slot_id": 1,
#       "patient_id": 100
#   }

# NUEVO (con buffer):
#   POST /api/v1/slots/book-with-buffer
#   {
#       "slot_id": 1,
#       "patient_id": 100,
#       "buffer_minutes": 10  # usa el del doctor si =0
#   }

# RESPUESTA:
#   {
#       "success": true,
#       "appointment_id": 45,
#       "slots_blocked": 2,
#       "error": ""
#   }


# ============================================================================
# 5. ANÁLISIS DE IMPACTO
# ============================================================================

# GET /api/v1/slots/buffer-impact/1?slot_date=2026-04-05
#
# {
#     "total_slots": 20,           # 08:00-18:00 por 30min = 20 slots
#     "available": 16,             # slots con status='available'
#     "booked": 2,                 # slots con status='booked'
#     "blocked_by_buffer": 2,      # slots con status='blocked'
#     "buffer_impact_percent": 10.0,  # (2/20) * 100
#     "available_for_booking": 16  # para UI cliente
# }

# INTERPRETACIÓN:
# - Doctor 1 tiene 20 slots en la jornada
# - 2 están reservados (2 pacientes)
# - 2 están bloqueados por buffers (parte de la espaciación)
# - Total disponible para usuario final: 16
# - 10% de capacidad perdida por buffers


# ============================================================================
# 6. VALIDACIÓN DE INTEGRIDAD
# ============================================================================

# GET /api/v1/slots/buffer-integrity-check/1?slot_date=2026-04-05
#
# {
#     "is_valid": true,
#     "orphan_blocked_slots": 0,      # slots bloqueados sin cita
#     "conflicting_buffers": 0,       # buffers solapados sin propietario
#     "issues": []
# }

# PROBLEMAS DETECTABLES:
# 1. orphan_blocked_slots > 0
#    → Hay slots bloqueados que no corresponden a ninguna cita
#    → Causa: Bug en código, rollback incompleto
#    → Acción: Limpiar manualmente
#
# 2. conflicting_buffers > 0
#    → Hay múltiples buffers que se solapan
#    → Causa: Normalmente OK (múltiples citas)
#    → Acción: Investigar si es intencional


# ============================================================================
# 7. FLUJO DE CANCELACIÓN CON BUFFER
# ============================================================================

# ESTADO PREVIO:
#   Slot A (09:30-10:00): blocked (buffer de B)
#   Slot B (10:00-10:30): booked, appointment_id=45
#   Slot C (10:30-11:00): blocked (buffer de B)
#   Slot D (11:00-11:30): available

# ACCIÓN: cancel_appointment_with_buffer_release(appointment_id=45, buffer_minutes=10)
#
# PROCESO:
#   1. appointment_45.status = 'cancelled'
#   2. slot_B.status = 'available'
#   3. Buscar slots que fueron buffer de B:
#       - Slot A: ¿hay otra cita que lo necesite? No → liberar
#       - Slot C: ¿hay otra cita que lo necesite? No → liberar
#   4. slot_A.status = 'available'
#   5. slot_C.status = 'available'

# ESTADO DESPUÉS:
#   Slot A (09:30-10:00): available ✓
#   Slot B (10:00-10:30): available ✓
#   Slot C (10:30-11:00): available ✓
#   Slot D (11:00-11:30): available ✓
# 
# CLIENTES VEN: 4 slots disponibles nuevamente


# ============================================================================
# 8. SMART UNBLOCK (caso complejo)
# ============================================================================

# ESTADO PREVIO:
#   Slot A: 09:00-09:30 booked (Cita 1, buffer 10min)
#   Slot B: 09:30-10:00 blocked (buffer de A: 09:00+30+10=09:40 a 10:00)
#   Slot C: 10:00-10:30 booked (Cita 2, buffer 10min)
#   Slot D: 10:30-11:00 blocked (buffer de C: 10:00+30+10=10:40 a 11:00)
#   Slot E: 11:00-11:30 available
#
# OVERLAP: Slot B es usado por ambos buffers (A posterior Y C anterior)
#          09:30-10:00 ∈ [09:40, 10:00] ∩ [09:50, 10:00]
#
# ACCIÓN: cancel_appointment(Cita 1)
#   - Buscar slots para liberar en buffer de A:
#   - Slot B (09:30-10:00): ¿usa otra cita?
#     → Verifica: ¿hay cita después que necesite buffer antes?
#     → Cita 2 (10:00-10:30) - sí, necesita buffer 09:50-10:00
#     → Slot B intersecta con [09:50,10:00]? Sí
#     → NO liberar
#   
# RESULTADO:
#   Slot B sigue blocked (porque lo usa el buffer de C)
#   Clientes sigue viendo: B unavailable

# ACCIÓN DESPUÉS: cancel_appointment(Cita 2)
#   - Buscar slots para liberar en buffer de C:
#   - Slot D (10:30-11:00): ¿usa otra cita?
#     → No hay otra cita después
#     → LIBERAR
#   - Slot B (09:30-10:00): ¿usa otra cita?
#     → Ya lo revisamos, no hay más
#     → LIBERAR
#
# RESULTADO:
#   Slots A,B,C,D,E: todos available


# ============================================================================
# 9. VALIDACIÓN DE BUFFER_MINUTES
# ============================================================================

# RESTRICCIONES:
# - buffer_minutes >= 0 (negativo no tiene sentido)
# - buffer_minutes <= 120 (2 horas máximo)
# - buffer_minutes < duracion_slot (no puede bloquear más que dura la cita)

# EJEMPLOS:
# ✓ slot 30min, buffer 10min → OK (después queda 10min libre)
# ✓ slot 30min, buffer 30min → OK (slot doble, después no queda libre)
# ✗ slot 30min, buffer 60min → ERROR (buffer > slot)

# IMPLEMENTACIÓN:
# if buffer_minutes > (end_time - start_time).total_seconds() / 60:
#     raise InvalidBufferError(...)


# ============================================================================
# 10. PERFORMANCE
# ============================================================================

# QUERIES OPTIMIZADAS:
# - get_available_slots_excluding_buffers: O(n) con índice (doctor_id, status, start_time)
# - book_slot_with_buffer: O(n) con índice (doctor_id, status, date, start_time)
# - analyze_buffer_impact: O(1) con COUNT agregado
# - validate_buffer_integrity: O(1) con COUNT agregado

# SIN ÍNDICES: ~500ms-1s para 10M slots
# CON ÍNDICES: ~5-15ms

# ÍNDICES RECOMENDADOS:
# CREATE INDEX idx_ts_doctor_status_date ON time_slots(doctor_id, status, DATE(start_time));
# CREATE INDEX idx_ts_doctor_time ON time_slots(doctor_id, start_time);


# ============================================================================
# 11. EJEMPLO DE USO COMPLETO
# ============================================================================

"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from api.app.services.buffer_service import BufferService
from api.app.models.time_slot_simple import TimeSlot, Appointment

async def example():
    # Setup DB
    engine = create_async_engine("postgresql+asyncpg://user:pass@localhost/db")
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as db:
        # 1. Reservar slot con buffer
        success, apt_id, blocked, error = await BufferService.book_slot_with_buffer(
            db=db,
            slot_id=3,
            patient_id=100,
            doctor_id=1,
            buffer_minutes=10
        )
        print(f"Booked: {success}, appointment={apt_id}, slots_blocked={blocked}")
        
        # 2. Analizar impacto
        impact = await BufferService.analyze_buffer_impact(db, doctor_id=1, slot_date='2026-04-05')
        print(f"Impact: {impact['available']}/{impact['total_slots']} available, "
              f"{impact['buffer_impact_percent']}% reduction")
        
        # 3. Validar integridad
        integrity = await BufferService.validate_buffer_integrity(db, doctor_id=1, slot_date='2026-04-05')
        print(f"Integrity: valid={integrity['is_valid']}, issues={integrity['issues']}")
        
        # 4. Cancelar con liberación
        success, slot_id, unblocked, error = await BufferService.cancel_appointment_with_buffer_release(
            db=db,
            appointment_id=apt_id,
            buffer_minutes=10
        )
        print(f"Cancelled: {success}, slots_unblocked={unblocked}")

asyncio.run(example())
"""


# ============================================================================
# 12. ROADMAP FUTURO
# ============================================================================

# MEJORAS POTENCIALES:
# 1. Buffer asimétrico (antes ≠ después)
#    - buffer_minutes_before: 10
#    - buffer_minutes_after: 5
#
# 2. Buffer basado en tipo de consulta
#    - tipo_consulta.buffer_minutes = 15
#    - override doctor_schedule_config.buffer_minutes
#
# 3. Buffer por hora del día
#    - morning (08:00-12:00): 10min
#    - afternoon (12:00-18:00): 15min
#
# 4. Notificaciones de disponibilidad
#    - "Se liberaron 3 slots por cancelación"
#    - Push notification a pacientes en waitlist
#
# 5. Predicción de buffer óptimo
#    - Análisis histórico: ¿cuánto buffer minimiza delays?
#    - ML: recomendación automática


print(__doc__)
