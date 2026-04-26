# VALIDACIONES TÉCNICAS Y PLAN DE PRUEBAS - GSentinelHealthOS

**Fecha:** 02 de Abril de 2026

---

## 1. PRUEBAS DE SEGURIDAD EJECUTABLES

### 1.1 Test: Inyección SQL en API

```bash
#!/bin/bash
# Test para validar SQL injection vulnerability

API_URL="http://localhost:8000"

# Test 1: Inyección en phone field
curl -X POST "$API_URL/api/v1/patients" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Patient",
    "phone": "+34\"; DROP TABLE appointments; --",
    "email": "test@example.com"
  }'

# Expected: 422 Validation Error (rechazar patrón inválido)
# Vulnerable: 500 Database Error (SQL injected)

# Test 2: Inyección en appointment reason
curl -X POST "$API_URL/api/v1/appointments" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Key: test-key" \
  -d '{
    "doctor_id": "550e8400-e29b-41d4-a716-446655440000",
    "patient_id": "550e8400-e29b-41d4-a716-446655440001",
    "date_time": "2026-04-15T10:00:00Z",
    "reason": "Pain\"; UPDATE appointments SET status='\''cancelled'\''; --"
  }'

# Expected: Schema validation error
# Vulnerable: Data corruption in DB
```

### 1.2 Test: Brute Force en Auth

```python
# tests/security/test_brute_force.py
import httpx
import asyncio
from datetime import datetime

async def test_brute_force_auth():
    """Simula ataque de brute force en /api/v1/auth/token"""
    
    client = httpx.AsyncClient()
    base_url = "http://localhost:8000"
    
    passwords = [
        "password123",
        "admin123",
        "12345678",
        "qwerty",
        "password",
    ]
    
    failed_attempts = 0
    blocked = False
    
    for i, password in enumerate(passwords):
        try:
            response = await client.post(
                f"{base_url}/api/v1/auth/token",
                json={"username": "doctor@hospital.com", "password": password}
            )
            
            if response.status_code == 401:
                failed_attempts += 1
                print(f"Attempt {i+1}: Failed (401)")
            
            elif response.status_code == 429:
                blocked = True
                print(f"Attempt {i+1}: BLOCKED (429) ✅ Rate limiter working")
                break
            
        except Exception as e:
            print(f"Attempt {i+1}: Error - {e}")
    
    # Test result
    if not blocked and failed_attempts == len(passwords):
        print("❌ VULNERABLE: Brute force possible (no rate limiting)")
        return False
    
    print(f"✅ PASS: Rate limiting after {failed_attempts} attempts")
    return True

# Run: pytest tests/security/test_brute_force.py -v
```

### 1.3 Test: OWASP A04 - Broken Access Control

```python
# tests/security/test_rbac.py
@pytest.mark.asyncio
async def test_doctor_cannot_access_other_doctor_appointments():
    """Verifica que Doctor A no pueda ver citas de Doctor B"""
    
    # Setup: Dos doctors, dos pacientes, una cita cada uno
    doctor_a_id = "550e8400-0000-0000-0000-000000000001"
    doctor_b_id = "550e8400-0000-0000-0000-000000000002"
    
    # Login como Doctor A
    token_a = await login_doctor(doctor_a_id)
    
    # Intenta acceder a citas de Doctor B
    response = httpx.get(
        "http://localhost:8000/api/v1/appointments/doctor/550e8400-0000-0000-0000-000000000002",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    
    # ✅ Esperado: 403 Forbidden
    assert response.status_code == 403, f"Got {response.status_code}, expected 403"
    
    # ❌ Vulnerable: 200 OK (Doctor A vee citas ajenas)
```

### 1.4 Test: Timing Attack - JWT Secret

```python
# Detecta si es posible adivinar JWT secret por timing
import time
import jwt

def test_jwt_secret_keyspace():
    """Verifica que JWT secret sea suficientemente fuerte"""
    
    # Obtener token
    token = login_and_get_token()
    
    # Intentar decodificar sin validar: timing side channel
    start = time.time()
    try:
        jwt.decode(token, "wrong_secret", algorithms=["HS256"])
    except jwt.InvalidSignatureError:
        pass
    elapsed = time.time() - start
    
    # ✅ Debe rechazar rápido (~0.001s)
    # ❌ Si tarda variable: timing attack posible
    assert elapsed < 0.005, f"JWT verification too slow: {elapsed}s"
```

---

## 2. PRUEBAS FUNCIONALES DE TURNOS

### 2.1 Escenario: Simultaneous Booking (Race Condition)

```python
# tests/integration/test_overbooking.py
@pytest.mark.asyncio
async def test_simultaneous_booking_prevents_overbooking():
    """
    Dos pacientes intentan reservar el mismo horario simultáneamente.
    Sistema debe permitir SOLO uno.
    """
    
    doctor_id = UUID("550e8400-e29b-41d4-a716-446655440000")
    appointment_time = datetime(2026, 4, 15, 10, 0, 0)
    
    patient1_id = UUID("550e8400-e29b-41d4-a716-446655440001")
    patient2_id = UUID("550e8400-e29b-41d4-a716-446655440002")
    
    # Mock DB para simular delay
    async def create_with_delay(patient_id):
        await asyncio.sleep(0.1)  # Simula latencia de BD
        return await appointment_service.create_appointment(
            AppointmentCreate(
                doctor_id=doctor_id,
                patient_id=patient_id,
                date_time=appointment_time,
                reason="Test"
            )
        )
    
    # Ejecutar simultáneamente
    results = await asyncio.gather(
        create_with_delay(patient1_id),
        create_with_delay(patient2_id),
        return_exceptions=True
    )
    
    # Validar
    success_count = sum(1 for r in results if not isinstance(r, Exception))
    error_count = sum(1 for r in results if isinstance(r, Exception))
    
    # ✅ ESPERADO: 1 éxito, 1 error (409 Conflict)
    assert success_count == 1, f"Expected 1 success, got {success_count}"
    assert error_count == 1, f"Expected 1 error, got {error_count}"
    
    # El error debe ser 409 Conflict
    conflict = next((r for r in results if isinstance(r, HTTPException)), None)
    assert conflict.status_code == 409, f"Expected 409, got {conflict.status_code}"
```

### 2.2 Escenario: Creación-Confirmación Transaccional

```python
# tests/integration/test_appointment_consistency.py
@pytest.mark.asyncio
async def test_appointment_and_outbox_consistency():
    """
    Si appointment se crea pero outbox falla:
    ❌ Cita en BD, no en cola → paciente no enterado
    ✅ Ambos creados juntos O ambos fallan
    """
    
    doctor_id = UUID("550e8400-0000-0000-0000-000000000001")
    patient_id = UUID("550e8400-0000-0000-0000-000000000002")
    
    async with db_session() as session:
        try:
            # Contar antes
            appointments_before = await session.scalar(
                select(func.count(Appointment.id))
            )
            outbox_before = await session.scalar(
                select(func.count(NotificationOutbox.id))
            )
            
            # Crear cita
            appointment = await appointment_service.create_appointment(
                AppointmentCreate(
                    doctor_id=doctor_id,
                    patient_id=patient_id,
                    date_time=datetime.utcnow() + timedelta(days=1),
                    reason="Test"
                )
            )
            
            # ✅ Ambos deben incrementar
            appointments_after = await session.scalar(
                select(func.count(Appointment.id))
            )
            outbox_after = await session.scalar(
                select(func.count(NotificationOutbox.id))
            )
            
            assert appointments_after == appointments_before + 1
            assert outbox_after == outbox_before + 1
            
        except Exception as e:
            # ✅ Si falla: ambos deben rollback
            appointments_final = await session.scalar(
                select(func.count(Appointment.id))
            )
            outbox_final = await session.scalar(
                select(func.count(NotificationOutbox.id))
            )
            
            assert appointments_final == appointments_before
            assert outbox_final == outbox_before
```

---

## 3. PRUEBAS DE PERFORMANCE

### 3.1 Load Test: Brain NLU Latency

```python
# loadtests/test_brain_latency.py
from locust import HttpUser, task, between
import json

class BrainUser(HttpUser):
    wait_time = between(1, 3)
    
    @task
    def send_message(self):
        """Simula envío de mensaje al Brain"""
        
        message = {
            "from": "+34612345678",
            "text": "Quiero una cita con un cardiólogo mañana a las 10 de la mañana"
        }
        
        # Publica en Redis
        self.client.post(
            "/api/debug/queue/publish",  # Endpoint de debug
            json=message,
            headers={"X-Internal-Key": "test-key"}
        )
        
        # Espera respuesta en Redis (timeout 5s)
        # Mide latencia

# Ejecutar:
# locust -f loadtests/test_brain_latency.py \
#   --host=http://localhost:8000 \
#   --users=100 \
#   --spawn-rate=10 \
#   --run-time=5m
```

### 3.2 DB Query Performance

```python
# tests/performance/test_db_queries.py
@pytest.mark.asyncio
async def test_get_doctor_appointments_query_speed():
    """Mide tiempo de query para obtener citas de un doctor"""
    
    doctor_id = UUID("550e8400-0000-0000-0000-000000000001")
    
    # Crear 1000 citas en BD
    for i in range(1000):
        appointment = Appointment(
            doctor_id=doctor_id,
            patient_id=UUID(f"550e8400-0000-0000-0000-{i:012d}"),
            date_time=datetime.utcnow() + timedelta(days=i%30),
            status="scheduled"
        )
        session.add(appointment)
    await session.commit()
    
    # Medir query
    import time
    start = time.time()
    
    query = select(Appointment).where(
        Appointment.doctor_id == doctor_id
    ).options(joinedload(Appointment.patient))
    
    appointments = await session.scalars(query)
    list(appointments)  # Force fetch
    
    elapsed = time.time() - start
    
    # ✅ Debe ser < 100ms con índices correctos
    # ❌ Si > 500ms: falta índice
    assert elapsed < 0.1, f"Query too slow: {elapsed:.3f}s"
```

---

## 4. PRUEBAS DE INTEGRACIÓN E2E

### 4.1 Flujo Completo: Mensaje WhatsApp → Cita

```python
# tests/integration/test_e2e_whatsapp_booking.py
@pytest.mark.asyncio
async def test_full_booking_flow():
    """
    E2E: Paciente envía mensaje → Brain procesa → Cita creada → 
    Confirmación en WhatsApp
    """
    
    patient_phone = "+34612345678"
    patient_name = "Juan Pérez"
    
    # 1️⃣ Webhook de Meta: Mensaje entrante
    webhook_data = {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "123",
            "changes": [{
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {"display_phone_number": "34912345678"},
                    "messages": [{
                        "from": patient_phone,
                        "id": "msg_123",
                        "timestamp": "1234567890",
                        "type": "text",
                        "text": {"body": "Quiero cita con un cardiólogo"},
                    }]
                }
            }]
        }]
    }
    
    # Simular webhook
    client = httpx.AsyncClient()
    response = await client.post(
        "http://localhost:8002/webhook/whatsapp",
        json=webhook_data,
        headers={"X-Hub-Signature-256": "sha256=..."}  # Firma válida
    )
    assert response.status_code == 200
    
    # 2️⃣ Brain procesa mensaje (waiting 2s)
    await asyncio.sleep(2)
    
    # 3️⃣ Verificar que cita fue creada
    db_session = get_db()
    patient = await db_session.scalar(
        select(Patient).where(Patient.phone == patient_phone)
    )
    assert patient is not None
    
    appointments = await db_session.scalars(
        select(Appointment).where(Appointment.patient_id == patient.id)
    )
    assert len(list(appointments)) >= 1
    
    # 4️⃣ Verificar que respuesta está en cola de salida
    redis_client = Redis.from_url(REDIS_URL)
    outgoing_message = await redis_client.rpop("whatsapp:outgoing")
    assert outgoing_message is not None
    
    message_data = json.loads(outgoing_message)
    assert message_data["phone"] == patient_phone
    assert "confirmación" in message_data["text"].lower()
```

### 4.2 Flujo: Cancelación de Cita

```python
@pytest.mark.asyncio
async def test_cancel_appointment_flow():
    """Paciente cancela cita a traves de Brain"""
    
    # ... Setup: crear cita ...
    
    # Enviar: "Cancelar mi cita para mañana"
    message = {
        "from": patient_phone,
        "text": "Cancelar mi cita para mañana"
    }
    
    # Brain debe:
    # 1. Identificar intent = "cancel_appointment"
    # 2. Encontrar cita de mañana
    # 3. Cambiar status a "cancelled"
    # 4. Confirmar a paciente
    
    result = await brain_orchestrator.handle_message(message)
    
    assert "cancelada" in result["text"].lower()
    
    # Verificar BD
    appointment = await db_session.scalar(
        select(Appointment).where(Appointment.id == cita_id)
    )
    assert appointment.status == "cancelled"
```

---

## 5. MÉTRICAS DE VALIDACIÓN

### 5.1 Checklist Pre-Producción

```
SEGURIDAD
  ☐ Auth endpoints tienen rate limiting (5/min)
  ☐ CORS whitelist completado
  ☐ Credenciales rotadas (no hardcodeadas)
  ☐ JWT secret > 32 bytes, aleatorio
  ☐ Todos inputs validados con Pydantic
  ☐ SQL injection tests: PASS
  ☐ XSS tests: PASS
  ☐ MFA implementado para médicos

FUNCIONALIDAD
  ☐ Simultaneous booking: sin overbooking
  ☐ Appointment + Outbox: transaccional
  ☐ Google Calendar: eventos creados
  ☐ Brain context: persiste > 1 hora
  ☐ Error recovery: reintentos automáticos
  ☐ E2E flow tests: PASS

PERFORMANCE
  ☐ Latencia promedio: < 2s
  ☐ P99 latencia: < 5s
  ☐ 100 usuarios concurrentes: sin errores
  ☐ DB queries: < 100ms
  ☐ Memory: < 512MB per pod

OBSERVABILIDAD
  ☐ Logs estructurados (JSON)
  ☐ Alertas de errores 5xx
  ☐ Alertas de latencia
  ☐ Trace de requests (correlation_id)
  ☐ Métricas de Groq availability

DEVOPS
  ☐ Redis con replicación
  ☐ PostgreSQL com hot-standby
  ☐ Ingress HTTPS
  ☐ Pod replicas: ≥ 3
  ☐ Autoscaling configurado
  ☐ Backup automatizado
  ☐ Disaster recovery: RTO < 1h

DOCUMENTACIÓN
  ☐ API docs (OpenAPI/Swagger)
  ☐ Runbook de oncall
  ☐ Architecture Decision Records
  ☐ Security policies
```

---

## 6. COMANDOS PARA EJECUTAR VALIDACIONES

```bash
#!/bin/bash
# scripts/validate_production_readiness.sh

set -e

echo "🔍 GSentinelHealthOS Production Readiness Check"
echo "================================================="

# 1. Tests de seguridad
echo "1. Security tests..."
pytest tests/security/ -v --tb=short

# 2. Tests de funcionalidad
echo "2. Functional tests..."
pytest tests/integration/test_overbooking.py -v

# 3. Performance baselines
echo "3. Performance tests..."
python scripts/perf_baseline.py

# 4. Security scan
echo "4. Dependency security audit..."
pip audit

# 5. Static analysis
echo "5. Static code analysis..."
bandit -r api brain shared -f json > bandit-report.json
mypy api brain --junit-xml=mypy-report.xml

# 6. Docker image scan
echo "6. Docker image vulnerability scan..."
docker scan sentinel-api:latest

# 7. Report
echo "✅ Validation complete. See reports in ./reports/"
```

---

## 7. UMBRAL DE ACEPTACIÓN

| Métrica | Umbral Mín | Umbral Opt |
|---------|-----------|-----------|
| Test Coverage | 70% | 85% |
| Security Vulnerabilities (Critical) | 0 | 0 |
| Security Vulnerabilities (High) | 0 | 0 |
| Performance P99 Latency | < 5s | < 2s |
| API Availability | 99% | 99.9% |
| Database Query Time (median) | < 100ms | < 50ms |
| Memory per pod | < 1GB | < 512MB |
| Bootstrap time | < 30s | < 15s |

---

## 8. PRÓXIMOS PASOS

1. Ejecutar validaciones en entorno de QA
2. Reportar vulnerabilidades encontradas
3. Corregir según Fase 1 roadmap
4. Re-validar con este suite
5. Aprobación de seguridad final

---

**Validación generada:** 02 de Abril de 2026  
**Versión:** 1.0  
**Estado:** PENDIENTE EJECUCIÓN

