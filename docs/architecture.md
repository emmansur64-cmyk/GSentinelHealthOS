# Arquitectura GSentinelHealthOS

## Visión General

GSentinelHealthOS es un sistema modular de gestión de citas médicas con IA integrada. La arquitectura se basa en **microservicios desacoplados** que comunican a través de **Redis** y **HTTP**.

### Principio Fundamental: Shared = Única Fuente de Verdad
- **Modelos SQLAlchemy** compartidos en `shared/models/`
- **Schemas Pydantic** compartidos en `shared/schemas/`
- **Utilidades** compartidas en `shared/utils/`

---

## Estructura de Carpetas

```
GSentinelHealthOS/
│
├── shared/                      # ✅ ÚNICA FUENTE DE VERDAD
│   ├── models/
│   │   └── __init__.py         # Base, Patient, Doctor, Appointment (SQLAlchemy)
│   ├── schemas/
│   │   └── __init__.py         # Schemas Pydantic para CRUD
│   ├── utils/
│   │   └── __init__.py         # Logging, validación, helpers
│   └── config.py               # Configuración centralizada
│
├── api/                         # 🔵 Backend Core - CRUD y Gestión
│   └── app/
│       ├── main.py             # FastAPI app
│       ├── core/               # config.py, security.py
│       ├── db/                 # session.py, init_db.py
│       ├── services/           # PatientService, DoctorService
│       ├── api/
│       │   └── v1/
│       │       ├── api.py      # Router principal
│       │       └── endpoints/
│       │           ├── patients.py
│       │           ├── doctors.py
│       │           └── health.py
│       ├── dependencies/       # Inyección de dependencias
│       ├── exceptions/         # Manejo de errores
│       └── models/             # VACÍA - usar shared/models
│
├── brain/                       # 🧠 Worker de IA - Asíncrono
│   ├── main.py                 # Consumer de cola
│   ├── core/
│   │   ├── config.py
│   │   └── logger.py
│   ├── interpreters/           # NLP, Intent analysis
│   ├── decision_engine/        # Lógica de agendamiento
│   ├── services/
│   │   └── brain_service.py
│   └── integration/
│       └── api_client.py       # Cliente HTTP para hablar con API
│
├── whatsapp_gateway/           # 📱 Transporte - Fast e Inmortal
│   ├── app/
│   │   └── main.py             # FastAPI ligera
│   ├── api/
│   │   └── routes/
│   │       └── webhook.py      # Webhook de Meta
│   ├── services/
│   │   └── whatsapp_service.py # Envío/recepción de mensajes
│   └── clients/                # HTTP clients
│
├── broker/                      # 🔄 Infraestructura de Mensajería
│   ├── redis.conf
│   └── rabbitmq.conf (opcional)
│
├── n8n/                         # 🤖 Solo para Side-Jobs
│   └── workflows/              # Reportes, alertas
│
├── database/
│   ├── init.sql                # Script de inicialización
│   └── migrations/             # Alembic migrations
│
├── docker/
│   ├── docker-compose.yml
│   ├── api.Dockerfile
│   ├── brain.Dockerfile
│   └── gateway.Dockerfile
│
├── tests/
│   ├── integration/            # Tests E2E: GW → Brain → API
│   └── unit/                   # Tests unitarios por módulo
│
├── .env.example
├── docker-compose.yml
└── requirements.txt
```

---

## Flujo de Datos

### 1️⃣ Creación de Cita (Usuario → WhatsApp)

```
Usuario envía mensaje WhatsApp
         ↓
WhatsApp Gateway recibe webhook
         ↓
Valida firma HMAC de Meta
         ↓
Parsea mensaje (from, text, timestamp)
         ↓
Encola en Redis: whatsapp:incoming
         ↓
Retorna 200 OK a Meta (rápido e inmortal)
```

### 2️⃣ Procesamiento de IA (Brain Worker)

```
Brain escucha: whatsapp:incoming
         ↓
Consume mensaje de cola
         ↓
BrainService.analyze_appointment_request()
  - NLP: extrae intención (specialty, fecha, etc)
  - Decision Engine: busca doctor disponible
         ↓
Encola acción: brain:actions
  (ej: schedule_appointment, send_message)
```

### 3️⃣ Agendamiento (Brain → API)

```
Brain llama API_CLIENT.post("/api/v1/appointments", data)
         ↓
API recibe request
         ↓
AppointmentService.create_appointment()
  - Valida paciente y doctor
  - Evita conflictos de horarios
  - Persiste en DB
         ↓
Retorna AppointmentResponse (201 Created)
         ↓
Brain encola: whatsapp:outgoing
  (mensaje para enviar al usuario)
```

### 4️⃣ Envío de Respuesta (Gateway → WhatsApp)

```
WhatsApp Gateway consume: whatsapp:outgoing
         ↓
Prepara payload para Meta API
         ↓
POST https://graph.instagram.com/v18.0/.../messages
  (Bearer token de Meta)
         ↓
Meta entrega mensaje al usuario
```

---

## Módulos Principales

### `shared/` - Única Fuente de Verdad

**Modelos SQLAlchemy** (`shared/models/`):
```python
Patient - id, name, email, phone, medical_history
Doctor - id, name, email, specialty, license_number
Appointment - patient_id, doctor_id, appointment_date, status
```

**Schemas Pydantic** (`shared/schemas/`):
- `PatientCreate`, `PatientUpdate`, `PatientResponse`
- `DoctorCreate`, `DoctorUpdate`, `DoctorResponse`
- `AppointmentCreate`, `AppointmentUpdate`, `AppointmentResponse`

**Utilidades** (`shared/utils/`):
```python
setup_logger() - logging consistente
validate_email(), validate_phone()
AppResponse - respuestas uniformes
PaginationParams - paginación
```

### `api/` - Backend Core

**Endpoints:**
- `POST /api/v1/patients` - Crear paciente
- `GET /api/v1/patients/{id}` - Obtener paciente
- `PUT /api/v1/patients/{id}` - Actualizar paciente
- `DELETE /api/v1/patients/{id}` - Eliminar paciente
- Similar para `/api/v1/doctors` y `/api/v1/appointments`

**Servicios:**
- `PatientService` - lógica de negocio para pacientes
- `DoctorService` - lógica de negocio para doctores
- Futura: `AppointmentService` - agendamiento con validaciones

### `brain/` - Worker de IA

**Procesamiento Asíncrono:**
```python
BrainService:
  - analyze_appointment_request(user_message)
  - recommend_appointments(patient_id)
  - validate_appointment(appointment_data)
  - process_queue_message(message)  # Consume de Redis
```

**Integración:**
```python
APIClient - comunica con API interna via HTTP
- GET /api/v1/patients/{id}
- POST /api/v1/appointments
- PUT /api/v1/doctors/{id}
```

### `whatsapp_gateway/` - Transporte

**Webhook:**
```
GET /webhook/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
  → Verifica y retorna challenge (setup inicial)

POST /webhook/whatsapp
  → Recibe mensajes de Meta
  → Valida firma HMAC
  → Encola en Redis
  → Retorna 200 OK (rápido)
```

**Servicios:**
```python
WhatsAppService:
  - verify_webhook()
  - verify_signature() - HMAC validation
  - parse_incoming_message()
  - send_message()

MessageQueueService:
  - enqueue_message() - Produce a Redis
```

---

## Flujo de Comunicación

```
┌─────────────────────────────────────────────────────────────┐
│                  EL USUARIO                                │
└─────────────────────────────────────────────────────────────┘
                           ↓
        "Quiero cita con cardiólogo mañana a las 10am"
                           ↓
┌─────────────────────────────────────────────────────────────┐
│        WhatsApp Gateway (Fast & Inmortal)                   │
│  - Recibe webhook de Meta                                   │
│  - Valida firma HMAC                                        │
│  - Parsea mensaje                                           │
│  - Encola en Redis ✅ (retorna 200 inmediatamente)         │
└─────────────────────────────────────────────────────────────┘
                           ↓
                 📋 Redis Queue
            whatsapp:incoming → "msg_001"
                           ↓
┌─────────────────────────────────────────────────────────────┐
│          Brain Worker (Async Consumer)                      │
│  - Consume mensaje de cola                                  │
│  - Analiza intención con NLP                                │
│  - Decision Engine busca doctor disponible                  │
│  - Llama API interna                                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
                    HTTP Call
                 POST /api/v1/appointments
                    appointment_data
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              API Core (Database)                            │
│  - Recibe request                                           │
│  - AppointmentService.create_appointment()                  │
│  - Valida paciente, doctor, horario                         │
│  - Persiste en PostgreSQL                                   │
│  - Retorna 201 Created + appointment_id                     │
└─────────────────────────────────────────────────────────────┘
                           ↓
                 HTTP Response
              201 + AppointmentResponse
                           ↓
            Brain encola respuesta al usuario
         whatsapp:outgoing → "Tu cita confirmada"
                           ↓
┌─────────────────────────────────────────────────────────────┐
│        WhatsApp Gateway (Envío Saliente)                    │
│  - Consume de whatsapp:outgoing                             │
│  - Llama Meta API                                           │
│  - Envía mensaje al usuario                                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
        ✅ Usuario recibe: "Tu cita confirmada..."
```

---

## Escalabilidad y Resilencia

### ✅ Fortalezas

1. **Desacoplamiento completo** - servicios pueden fallar sin afectar otros
2. **Redis como buffer** - sistema aguanta picos de tráfico
3. **Verificación de firma** - solo procesa mensajes legítimos de Meta
4. **Respuesta rápida al usuario** - Gateway retorna 200 inmediatamente
5. **Procesamiento asíncrono** - Brain puede tomar el tiempo necesario
6. **Base de datos centralizada** - `shared/` como fuente única de verdad

### 🔄 Comunicación

- **Interno (API ↔ Brain):** HTTP REST
- **Async (Workers):** Redis queues
- **Externo (Meta):** Webhooks + API

### 🔐 Seguridad

- **Webhook verification:** HMAC-SHA256
- **API authentication:** Bearer tokens (futuro)
- **Data validation:** Pydantic schemas
- **Environment variables:** `.env` para secretos

---

## Deployment

### Local Development

```bash
# 1. Instalar dependencias
pip install -r requirements.txt

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con credenciales de Meta

# 3. Correr con Docker Compose
docker-compose up -d

# 4. Verificar salud
curl http://localhost:8000/api/health/readiness
curl http://localhost:8002/health
```

### Production

- Usar **PostgreSQL** en lugar de SQLite
- Configurar **Redis Sentinel** o Cluster
- Usar **Nginx** como reverse proxy
- Habilitar **HTTPS** en webhooks
- Monitoreo con **Prometheus + Grafana**
- Logging centralizado con **ELK Stack**

---

## Pruebas

### Unitarias

```bash
pytest tests/unit/test_patient_service.py
pytest tests/unit/test_brain_service.py
```

### Integración (E2E)

```bash
pytest tests/integration/test_full_flow.py
# Simula: GW → Redis → Brain → API → DB → Response
```

---

## Próximos Pasos

1. ✅ Validación de intención en Brain
2. ✅ Recomendaciones de doctores con ML
3. ✅ Confirmaciones de citas
4. ✅ Notificaciones recordatorio (N8N workflow)
5. ✅ Dashboard admin
6. ✅ Reportes semanales

---

## Referencias

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [Meta WhatsApp API](https://developers.facebook.com/docs/whatsapp)
- [Redis Documentation](https://redis.io/docs/)
