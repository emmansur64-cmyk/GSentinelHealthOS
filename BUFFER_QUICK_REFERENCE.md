# ⚡ Quick Reference: Buffers API

Guía rápida para desarrolladores: cómo usar buffers en 5 minutos.

---

## 🎯 En Palabras Simples

**Buffer = Bloqueo automático de slots adyacentes**

```
SIN Buffer:
  10:00-10:30 booked
  10:30-11:00 available ← Cliente puede reservar inmediatamente
  ✗ Sin descanso para doctor

CON Buffer (10 min):
  09:50-10:00 blocked   ← No disponible
  10:00-10:30 booked
  10:30-10:40 blocked   ← No disponible
  10:40-11:00 available ← Cliente ve disponible desde aquí
  ✓ Doctor tiene 10 min antes y después

Result: 20% menos disponibilidad, pero con espaciación.
```

---

## 📦 Instalación

### 1. Schema SQL
```sql
-- Ejecutar SOLO UNA VEZ
psql -U user -d db < scripts/buffers_between_appointments.sql

-- Verifica:
SELECT * FROM doctor_schedule_config LIMIT 1;
-- Debe tener columna: buffer_minutes
```

### 2. Python Service
```python
# Ya existe en:
from api.app.services.buffer_service import BufferService
```

### 3. API
```python
# Ya existe en:
from api.app.api.v1.endpoints.buffer_slots import router
```

---

## 🚀 Uso Básico (Copiar-Pegar)

### 1. Configurar Buffer para Doctor
```python
from sqlalchemy import update
from api.app.models.time_slot_simple import DoctorScheduleConfig

# Doctor 1: 10 minutos de buffer
session.execute(
    update(DoctorScheduleConfig)
    .where(DoctorScheduleConfig.doctor_id == 1)
    .values(buffer_minutes=10)
)
session.commit()
```

### 2. Reservar con Buffer
```python
from api.app.services.buffer_service import BufferService

success, apt_id, slots_blocked, error = await BufferService.book_slot_with_buffer(
    db=db,
    slot_id=3,
    patient_id=100,
    doctor_id=1,
    buffer_minutes=10
)

if success:
    print(f"✓ Reservado: appointment={apt_id}, bloqueados={slots_blocked} slots")
else:
    print(f"✗ Error: {error}")
```

### 3. Cancelar (Libera Buffers)
```python
success, slot_id, slots_unblocked, error = await BufferService.cancel_appointment_with_buffer_release(
    db=db,
    appointment_id=45,
    buffer_minutes=10
)

if success:
    print(f"✓ Cancelado: slot={slot_id}, desbloqueados={slots_unblocked}")
else:
    print(f"✗ Error: {error}")
```

### 4. Ver Disponibilidad sin Buffers
```python
from datetime import date

slots = await BufferService.get_available_slots_excluding_buffers(
    db=db,
    doctor_id=1,
    slot_date=date(2026, 4, 5),
    exclude_blocked=True  # Solo 'available', sin 'blocked'
)

print(f"Slots disponibles: {len(slots)}")
for slot in slots:
    print(f"  {slot.start_time} - {slot.end_time}")
```

### 5. Analizar Impacto
```python
impact = await BufferService.analyze_buffer_impact(
    db=db,
    doctor_id=1,
    slot_date=date(2026, 4, 5)
)

print(f"Total: {impact['total_slots']}")
print(f"Disponibles: {impact['available']}")
print(f"Reservados: {impact['booked']}")
print(f"Bloqueados: {impact['blocked_by_buffer']}")
print(f"Impacto: {impact['buffer_impact_percent']}%")
```

### 6. Validar Integridad
```python
integrity = await BufferService.validate_buffer_integrity(
    db=db,
    doctor_id=1,
    slot_date=date(2026, 4, 5)
)

if integrity['is_valid']:
    print("✓ Sistema íntegro")
else:
    print(f"✗ Problemas detectados:")
    for issue in integrity['issues']:
        print(f"  - {issue}")
```

---

## 🌐 Uso vía REST API

### Endpoint 1: Reservar con Buffer
```bash
curl -X POST http://localhost:8000/api/v1/slots/book-with-buffer \
  -H "Content-Type: application/json" \
  -d '{
    "slot_id": 3,
    "patient_id": 100,
    "buffer_minutes": 10
  }'

# Response:
{
  "success": true,
  "appointment_id": 45,
  "slots_blocked": 2,
  "error": ""
}
```

### Endpoint 2: Cancelar
```bash
curl -X POST http://localhost:8000/api/v1/slots/cancel-with-buffer-release \
  -H "Content-Type: application/json" \
  -d '{
    "appointment_id": 45,
    "buffer_minutes": 10
  }'

# Response:
{
  "success": true,
  "slot_id": 3,
  "slots_unblocked": 2,
  "error": ""
}
```

### Endpoint 3: Slots Disponibles
```bash
curl "http://localhost:8000/api/v1/slots/available-excluding-buffers/1?slot_date=2026-04-05"

# Response:
[
  {
    "slot_id": 1,
    "doctor_id": 1,
    "start_time": "2026-04-05T08:00:00",
    "end_time": "2026-04-05T08:30:00",
    "status": "available",
    "is_buffer_affected": false
  },
  ...
]
```

### Endpoint 4: Analizar Impacto
```bash
curl "http://localhost:8000/api/v1/slots/buffer-impact/1?slot_date=2026-04-05"

# Response:
{
  "total_slots": 20,
  "available": 16,
  "booked": 2,
  "blocked_by_buffer": 2,
  "buffer_impact_percent": 10.0,
  "available_for_booking": 16
}
```

### Endpoint 5: Validar Integridad
```bash
curl "http://localhost:8000/api/v1/slots/buffer-integrity-check/1?slot_date=2026-04-05"

# Response:
{
  "is_valid": true,
  "orphan_blocked_slots": 0,
  "conflicting_buffers": 0,
  "issues": []
}
```

### Endpoint 6: Obtener Config
```bash
curl "http://localhost:8000/api/v1/slots/doctor-buffer-config/1"

# Response:
{
  "doctor_id": 1,
  "buffer_minutes": 10,
  "effective_date": "2026-04-05T10:30:00"
}
```

---

## 🧠 Conceptos Clave

### Estado de Slots
```
available  → Libre, cliente puede reservar
booked     → Reservado, cita confirmada
blocked    → Bloqueado por buffer, cliente NO ve
cancelled  → Cita cancelada, se libera slot
```

### Smart Unblock Logic
```
Problema: Dos citas con buffers solapados

  Cita A: 10:00-10:30 (buffer 10min)
    → Bloquea: 09:50-10:40

  Cita B: 10:30-11:00 (buffer 10min)
    → Bloquea: 10:20-11:10

Slot 10:30-11:00 ∈ ambos buffers

Cancel(A):
  → ¿Puedo liberar 10:30-11:00?
  → Verifica: ¿B lo necesita?
  → Respuesta: Sí
  → NO liberar ← Smart unblock

Cancel(B):
  → ¿Puedo liberar 10:30-11:00?
  → Verifica: ¿hay otra cita?
  → Respuesta: No
  → LIBERAR ← Safe cleanup
```

---

## 🚨 Errores Comunes

### Error: "Slot not available"
```python
# ✗ Problema:
success, _, _, _ = await BufferService.book_slot_with_buffer(
    db=db,
    slot_id=5,  # ← Status no es 'available'
    ...
)

# ✓ Solución:
slots = await BufferService.get_available_slots_excluding_buffers(...)
print([s.id for s in slots])  # Verificar que existe
```

### Error: "Appointment not found"
```python
# ✗ Problema:
await BufferService.cancel_appointment_with_buffer_release(
    db=db,
    appointment_id=99999,  # ← No existe
    ...
)

# ✓ Solución:
# Usar appointment_id retornado por book_slot_with_buffer
```

### Problema: Buffers muy restrictivos
```python
# ✗ Problema:
buffer_minutes = 120  # 2 horas → muy grande

# ✓ Solución:
buffer_minutes = 10  # 10-15 min es típico para médicos
```

---

## 🐛 Debug Mode

### Ver Estado de Todos los Slots
```python
from api.app.models.time_slot_simple import TimeSlot

slots = session.query(TimeSlot).filter(
    TimeSlot.doctor_id == 1,
    func.date(TimeSlot.start_time) == date(2026, 4, 5)
).all()

for slot in slots:
    print(f"{slot.start_time}-{slot.end_time}: {slot.status}")
```

### Ver Appointments
```python
from api.app.models.time_slot_simple import Appointment

appointments = session.query(Appointment).filter(
    Appointment.status != 'cancelled'
).all()

for apt in appointments:
    print(f"Apt {apt.id}: slot={apt.slot_id}, patient={apt.patient_id}")
```

### Limpiar Estado (SOLO TESTING)
```python
# ⚠️ SOLO en entornos de test/dev
from sqlalchemy import update

# Reset slots a 'available'
session.execute(
    update(TimeSlot)
    .where(TimeSlot.doctor_id == 1)
    .values(status='available')
)

# Delete appointments
session.query(Appointment).delete()
session.commit()
```

---

## 📊 Casos de Uso Típicos

### Caso 1: Clínica General
```
Buffer: 5 min (tiempo de limpieza)
Slots: 30 min
Disponibilidad: 91% (5/30 bloqueados)
```

### Caso 2: Cirugía
```
Buffer: 30 min (desinfección, preparación)
Slots: 60 min
Disponibilidad: 50% (30/60 bloqueados)
```

### Caso 3: Psicología
```
Buffer: 10 min (notas, transición)
Slots: 45 min
Disponibilidad: 78% (10/45 bloqueados)
```

### Caso 4: Dentista
```
Buffer: 15 min (limpieza de equipo)
Slots: 30 min
Disponibilidad: 50% (15/30 bloqueados)
```

---

## ⚙️ Configuración

### Por Doctor
```python
# Doctor 1 = 10 min buffer
UPDATE doctor_schedule_config SET buffer_minutes=10 WHERE doctor_id=1;

# Doctor 2 = sin buffer
UPDATE doctor_schedule_config SET buffer_minutes=0 WHERE doctor_id=2;

# Doctor 3 = 30 min buffer
UPDATE doctor_schedule_config SET buffer_minutes=30 WHERE doctor_id=3;
```

### Dinámicamente (Sesión)
```python
# Reservar con buffer específico (override doctor config)
await BufferService.book_slot_with_buffer(
    ...,
    buffer_minutes=15  # ← Usa esto, no doctor config
)
```

---

## 🧪 Testing

### Test Básico
```python
from tests.test_buffer_service import test_book_with_buffer_blocks_adjacent_slots
import pytest

# Ejecutar
pytest tests/test_buffer_service.py::test_book_with_buffer_blocks_adjacent_slots -v
```

### Test Full Workflow
```python
# Ejecutar suite completa
pytest tests/test_buffer_service.py -v --cov=api.app.services.buffer_service
```

---

## 📈 Performance

### Expected Latencies
```
book_slot_with_buffer:        ~10-15ms
cancel_with_buffer_release:   ~10-20ms
analyze_buffer_impact:        ~1-3ms
validate_buffer_integrity:    ~2-5ms
get_available_slots:          ~5-10ms
```

### Optimizaciones
```sql
-- Crear índices si no existen:
CREATE INDEX idx_ts_doctor_status_date 
  ON time_slots(doctor_id, status, DATE(start_time));

CREATE INDEX idx_ts_doctor_time 
  ON time_slots(doctor_id, start_time);
```

---

## 🔗 Enlaces Útiles

- **Guía Completa:** [BUFFER_INTEGRATION_GUIDE.md](./BUFFER_INTEGRATION_GUIDE.md)
- **SQL Functions:** [scripts/buffers_between_appointments.sql](./scripts/buffers_between_appointments.sql)
- **Python Service:** [api/app/services/buffer_service.py](./api/app/services/buffer_service.py)
- **Tests:** [tests/test_buffer_service.py](./tests/test_buffer_service.py)
- **API Endpoints:** [api/app/api/v1/endpoints/buffer_slots.py](./api/app/api/v1/endpoints/buffer_slots.py)

---

## ✅ Checklist Antes de Producción

- [ ] Buffers configurados para todos los doctors
- [ ] Tests pasan (pytest)
- [ ] Índices de DB creados
- [ ] Monitoreo de integridad habilitado
- [ ] Validación de orphan blocks cada 6h
- [ ] Alertas de conflictos de buffers
- [ ] Frontend muestra slots bloqueados (opcional)
- [ ] Usuarios notificados de cambios

---

## 🆘 Support

- **Errores DB:** Contactar DBA
- **Errores API:** Contactar Backend Team
- **Errores Tests:** Contactar QA
- **Buffers:** Contactar Product Team

---

**¡Listo para usar! 🚀**

Tiempo estimado: 5 min lectura + 10 min integración.
