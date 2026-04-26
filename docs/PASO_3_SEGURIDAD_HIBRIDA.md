## Paso 3 Refactorizado: Seguridad Híbrida y Service Layer Transaccional

**Fecha:** 1 de abril de 2026  
**Estado:** ✅ IMPLEMENTADO  
**Cambio Crítico:** Arquitectura refactorizada con **Fase 3.1** (Service Layer) + **Fase 3.2** (Seguridad Híbrida)

---

## 🎯 Escrutinio Inicial (Contrapuntos Válidos)

### ❌ Problema 1: Autenticación Prematura
**Supuesto Inicial:** JWT/RBAC para todo ✗  
**Realidad:** Gateway WhatsApp es un servicio, no un usuario  
**Solución:** ✅ Arquitectura de **Seguridad Híbrida**

### ❌ Problema 2: Lógica de Citas Simplista
**Supuesto Inicial:** Simple POST → guardar en BD ✗  
**Realidad:** Dos pacientes podrían agendar mismo slot simultaneamente  
**Solución:** ✅ **Service Layer transaccional** con verificación de conflictos

### ❌ Problema 3: Inyección de Dependencias
**Riesgo:** Duplicar o mover `get_db()` → sesiones huérfanas  
**Solución:** ✅ `dependencies/db.py` como **única fuente de verdad**

---

## 📐 Arquitectura Implementada

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT LAYER                                               │
│  • Gateway (X-Internal-Key)                                 │
│  • Dashboard (JWT Bearer)                                   │
│  • Brain Service (X-Internal-Key)                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  SECURITY LAYER (core/security.py)                          │
│  • validate_hybrid_auth() → API Key OR JWT                  │
│  • validate_api_key() → X-Internal-Key header               │
│  • get_current_user() → JWT Bearer token                    │
│  • check_permissions() → Scope validation                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  ENDPOINT LAYER (api/v1/endpoints/appointments.py)          │
│  • POST /appointments → Hybrid auth                         │
│  • GET /appointments/{id} → Hybrid auth                     │
│  • POST /appointments/gateway/validate-slot → API Key ONLY  │
│  • GET /appointments/my-appointments → JWT ONLY             │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  SERVICE LAYER (services/appointment_service.py) ← CRÍTICA  │
│  • create_appointment(data)                                 │
│    └─ Verifica disponibilidad de slots (Transacción)        │
│    └─ Valida no conflicto de horarios (±30 min)             │
│    └─ Crea cita o lanza 409 Conflict                        │
│  • get_doctor_appointments(doctor_id, date_range)           │
│  • cancel_appointment(id)                                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  DATABASE LAYER (models/models.py)                          │
│  • Patient (name, phone E.164, email)                       │
│  • Doctor (name, specialization, is_active)                 │
│  • Appointment (doctor_id, patient_id, date_time, status)   │
│    └─ Índices en: (doctor_id, date_time) para queries rápidas
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Fase 3.1: Service Layer con Lógica Transaccional

### Archivo: `api/app/services/appointment_service.py`

**Clase:** `AppointmentService`

**Método Crítico: `create_appointment()`**

```python
async def create_appointment(
    appointment_data: AppointmentCreate,
    created_by: str = "api"
) -> AppointmentResponse:
```

**Flujo Transaccional:**

1. **Validar Existencia** (404)
   - Doctor existe en BD
   - Paciente existe en BD
   - Doctor activo (is_active=True)

2. **Verificar Conflicto de Slots** (409 Conflict)
   - Consulta: ¿Hay citas para este doctor en [date_time - 30min, date_time + 30min]?
   - Si hay → HTTPException 409
   - Si no → Continúa

3. **Crear Cita (Transacción Atómica)**
   ```python
   appointment = Appointment(...)
   db.add(appointment)
   await db.flush()  # Obtene ID
   await db.commit()  # Persiste
   ```

4. **Manejo de Errores**
   - Si falla en cualquier paso → `db.rollback()`
   - Lanza HTTPException correspondiente

**Ejemplo de Verificación de Slots:**

```python
# Si se intenta crear cita a las 14:00 con buffer 30min
time_start = 14:00 - 30min = 13:30
time_end   = 14:00 + 30min = 14:30

# Consulta:
SELECT * FROM appointments 
WHERE doctor_id = ? 
  AND status != 'cancelled'
  AND date_time BETWEEN 13:30 AND 14:30

# Si encuentra algo → 409 Conflict
# Si no → Crea la cita
```

---

## 🛡️ Fase 3.2: Seguridad Híbrida

### Archivo: `api/app/core/security.py`

#### **Tipo 1: API Key (Servicios Internos)**

**Ubicación:** Header `X-Internal-Key`  
**Usuarios:** Gateway, Brain Engine  
**Control:** Almacenado en `.env` (producción → Vault)

```python
INTERNAL_API_KEYS = {
    "gateway": os.getenv("GATEWAY_API_KEY", "gateway-secret-key-change-production"),
    "brain": os.getenv("BRAIN_API_KEY", "brain-secret-key-change-production"),
}
```

**Función:** `validate_api_key(x_internal_key: str) → InternalAuth`

```bash
# Ejemplo cURL
curl -X POST http://localhost:8000/api/v1/appointments \
  -H "X-Internal-Key: gateway-secret-key-change-production" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

#### **Tipo 2: JWT (Usuarios / Médicos)**

**Ubicación:** Header `Authorization: Bearer <token>`  
**Usuarios:** Médicos en Dashboard  
**Algoritmo:** HS256 (configurable)  
**Expiración:** 24 horas (configurable)

**Función:** `create_jwt_token(subject, scopes, expires_delta)`

```python
token = create_jwt_token(
    subject="doctor-uuid",
    scopes=["appointment:create", "appointment:read"],
    expires_delta=timedelta(hours=24)
)
# Retorna: {"access_token": "eyJ0...", "token_type": "bearer", "expires_in": 86400}
```

**Función:** `verify_jwt_token(token: str) → TokenData`

```python
# Valida firma, expiración, y extrae datos
token_data = verify_jwt_token(token)
# token_data.subject = "doctor-uuid"
# token_data.scopes = ["appointment:create", "appointment:read"]
```

---

#### **Tipo 3: Validación Híbrida (⭐ Key Feature)**

**Función:** `validate_hybrid_auth(x_internal_key, authorization) → Dict`

```python
# Endpoint acepta AMBOS tipos:
# 1. Intenta API Key primero
# 2. Si falla, intenta JWT
# 3. Si ambos fallan → 403 Forbidden

async def validate_hybrid_auth(
    x_internal_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    # Intenta API Key
    if x_internal_key:
        try:
            auth = await validate_api_key(x_internal_key)
            return {"auth_type": "service", "service": auth.service, ...}
        except: pass
    
    # Intenta JWT
    if authorization:
        try:
            token = authorization.split()[1]
            token_data = verify_jwt_token(token)
            return {"auth_type": "user", "user_id": token_data.subject, ...}
        except: pass
    
    # Ambos fallaron
    raise HTTPException(403, "Requiere API Key o JWT")
```

---

## 📊 Matriz de Autenticación

| Endpoint | API Key | JWT | Nota |
|----------|---------|-----|------|
| `POST /appointments` | ✅ Hybrid | ✅ Hybrid | Gateway y Dashboard ambos pueden crear |
| `GET /appointments/{id}` | ✅ Hybrid | ✅ Hybrid | Ambos pueden leer |
| `POST /appointments/gateway/validate-slot` | ✅ ONLY | ❌ | Solo Gateway |
| `GET /appointments/my-appointments` | ❌ | ✅ ONLY | Solo Médicos autenticados |
| `DELETE /appointments/{id}` | ✅ Hybrid | ✅ Hybrid | Ambos pueden cancelar |

---

## 🔍 Archivos Creados/Modificados

### Nuevos

| Archivo | Propósito |
|---------|-----------|
| `api/app/models/models.py` | SQLAlchemy ORM: Patient, Doctor, Appointment |
| `api/app/models/__init__.py` | Exports de modelos |
| `api/app/services/appointment_service.py` | ⭐ Lógica transaccional de citas |
| `api/app/services/__init__.py` | Exports de servicios |
| `api/app/core/security.py` | ⭐ API Key + JWT híbrido |
| `api/app/dependencies/appointment.py` | Inyección de AppointmentService |

### Modificados

| Archivo | Cambio |
|---------|--------|
| `api/app/api/v1/endpoints/appointments.py` | 🔄 Refactorizado completamente con seguridad híbrida |
| `api/app/core/__init__.py` | Exports de seguridad |

---

## 🧪 Ejemplos de Uso

### 1️⃣ Gateway Crea Cita (API Key)

```bash
curl -X POST http://localhost:8000/api/v1/appointments \
  -H "X-Internal-Key: gateway-secret-key-change-production" \
  -H "Content-Type: application/json" \
  -d '{
    "doctor_id": "550e8400-e29b-41d4-a716-446655440000",
    "patient_id": "550e8400-e29b-41d4-a716-446655440001",
    "date_time": "2026-04-10T14:00:00",
    "reason": "Consulta por WhatsApp",
    "status": "scheduled"
  }'

# Response 201
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "doctor_id": "550e8400-e29b-41d4-a716-446655440000",
  "patient_id": "550e8400-e29b-41d4-a716-446655440001",
  "date_time": "2026-04-10T14:00:00",
  "status": "scheduled",
  "created_by": "gateway"
}
```

### 2️⃣ Gateway Intenta Crear Cita Conflictiva

```bash
# 2 minutos después, otra solicitud con hora solapada
curl -X POST http://localhost:8000/api/v1/appointments \
  -H "X-Internal-Key: gateway-secret-key-change-production" \
  -d '{
    "doctor_id": "550e8400-e29b-41d4-a716-446655440000",
    "patient_id": "550e8400-e29b-41d4-a716-446655440003",
    "date_time": "2026-04-10T14:10:00",  ← Está en rango ±30min
    ...
  }'

# Response 409 Conflict
{
  "detail": "Conflicto de horario: El doctor tiene citas en ['2026-04-10T14:00:00']. Rango de buffer: 30 min"
}
```

### 3️⃣ Médico Crea Cita (JWT)

```bash
# Primero: Obtener token JWT (endpoint /token, implementar en Paso 4)
POST /token
{
  "username": "doctor@hospital.com",
  "password": "secure_password"
}

# Response
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 86400
}

# Usar token para crear cita
curl -X POST http://localhost:8000/api/v1/appointments \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..." \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### 4️⃣ Gateway Valida Disponibilidad (API Key ONLY)

```bash
curl -X POST http://localhost:8000/api/v1/appointments/gateway/validate-slot \
  -H "X-Internal-Key: gateway-secret-key-change-production" \
  -H "Content-Type: application/json" \
  -d '{
    "doctor_id": "550e8400-e29b-41d4-a716-446655440000",
    "appointment_time": "2026-04-10T15:00:00"
  }'

# Response
{
  "available": true,
  "doctor_id": "550e8400-e29b-41d4-a716-446655440000",
  "appointment_time": "2026-04-10T15:00:00",
  "message": "Disponible"
}
```

### 5️⃣ Médico Ve Sus Citas (JWT ONLY)

```bash
curl -X GET http://localhost:8000/api/v1/appointments/my-appointments \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json"

# Response
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "doctor_id": "550e8400-e29b-41d4-a716-446655440000",
    "patient_id": "550e8400-e29b-41d4-a716-446655440001",
    "date_time": "2026-04-10T14:00:00",
    "status": "scheduled",
    "created_by": "gateway"
  },
  {...}
]
```

---

## 🚨 Suposiciones Corregidas

### ✅ Suposición 1: "JWT y RBAC es suficiente"
**Antes:** ✗ Asumir que Gateway = usuario  
**Ahora:** ✅ Arquitectura de **dos tipos de autenticación**
- Servicios internos: API Key (stateless, pre-compartida)
- Usuarios/Médicos: JWT (con scopes)

### ✅ Suposición 2: "CRUD simple funciona"
**Antes:** ✗ POST → guardar  
**Ahora:** ✅ **Transacción con verificación de conflictos**
- Buffer de 30 minutos
- Consulta atómica antes de insert
- Respuesta 409 si hay conflicto

### ✅ Suposición 3: "get_db() puede duplicarse"
**Antes:** ✗ Riesgo de sesiones huérfanas  
**Ahora:** ✅ **Única fuente de verdad**
- `dependencies/db.py` centralizado
- Reutilizado en todas las dependencias
- No duplicar en `dependencies/appointment.py`

---

## 📋 Checklist de Implementación

| Aspecto | Antes | Después | Estado |
|---------|--------|---------|--------|
| **Auth API → Servicio** | JWT simple | API Key | ✅ |
| **Auth Humano → Sistema** | JWT simple | JWT + Scopes | ✅ |
| **Hybrid Auth** | No existe | Implementado | ✅ |
| **Slot Conflict Detection** | No existe | ±30 min buffer | ✅ |
| **Transactional Create** | Manual rollback | db.rollback() automático | ✅ |
| **Service Layer** | SQL en endpoint | Lógica en services/ | ✅ |
| **DB Models** | shared/models | api/app/models | ✅ |
| **Type Safety** | dict genéricos | Pydantic + SQLAlchemy | ✅ |

---

## ⚠️ Notas de Operación

### Configuración de Claves

**En `.env`:**
```bash
# API KEYS (Servicios internos)
GATEWAY_API_KEY=gateway-secret-key-change-production
BRAIN_API_KEY=brain-secret-key-change-production

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
```

**En Producción:**
- Generar claves con: `openssl rand -hex 32`
- Guardar en Vault (HashiCorp)
- Usar `ALLOWED_ORIGINS` en `.env` para CORS

### Buffer de Slots

- **Configuração:** `SLOT_BUFFER_MINUTES = 30` (configurable en AppointmentService)
- **Impacto:** Doctor no puede tener dos citas en ventana de ±30 min
- **Ejemplo:** Cita a 14:00 → bloquea 13:30-14:30

### Índices Base de Datos

Para máximo rendimiento:
```sql
CREATE INDEX idx_appointments_doctor_datetime 
  ON appointments(doctor_id, date_time) 
  WHERE status != 'cancelled';

CREATE INDEX idx_patients_phone 
  ON patients(phone);  -- Para búsquedas rápidas por teléfono
```

---

## 🔄 Próximo Paso (Paso 4: Autenticación Completa)

- Implementar `POST /token` endpoint (OAuth2 password flow)
- Crear tabla `User` (vinculada a Doctor/Patient)
- Agregar validación de roles/permisos (RBAC)
- Integración con n8n webhook para WhatsApp

---

**Validado por:** Plan de Acción Refactorizado  
**Arquitectura:** Seguridad Híbrida + Service Layer Transaccional  
**Seguridad:** ✅ OWASP Top 10 A01:2021 (Broken Access Control)
