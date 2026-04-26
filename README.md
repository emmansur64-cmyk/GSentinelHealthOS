# GSentinelHealthOS 🏥

Sistema modular de gestión de citas médicas con IA integrada, diseñado para escalar.

## 🎯 Características

✅ **API REST** - CRUD de pacientes, doctores, citas  
✅ **AI Brain** - Análisis de intención con NLP  
✅ **WhatsApp Integration** - Webhooks de Meta con validación HMAC  
✅ **Async Processing** - Cola Redis para procesamiento asíncrono  
✅ **Microservicios** - Arquitectura desacoplada y escalable  
✅ **Docker** - Orquestación completa con docker-compose  
✅ **Arquitectura Limpia** - `shared/` como única fuente de verdad  

---

## 🏗️ Arquitectura

Consulta [docs/architecture.md](docs/architecture.md) para detalles completos.

```
WhatsApp → Gateway → Redis → Brain (IA) → API (CRUD) → PostgreSQL
```

### Componentes

| Módulo | Puerto | Función |
|--------|--------|---------|
| **API** | 8000 | Backend CRUD |
| **Brain** | 8001 | Worker IA asíncrono |
| **Gateway** | 8002 | Webhooks de WhatsApp |
| **Redis** | 6379 | Cola de mensajes |
| **PostgreSQL** | 5432 | Base de datos |

---

## 🚀 Inicio Rápido

### Requisitos

- Python 3.11 a 3.13
- Docker & Docker Compose
- Redis
- PostgreSQL

Nota:
Para `MetaBrain` con `Groq`, la versión recomendada es `Python 3.12`. En este repo evitamos `Python 3.14+` para producción porque varias dependencias todavía tienen compatibilidad parcial en Windows.

### Setup Local

```bash
# 1. Clonar repo
git clone ...
cd GSentinelHealthOS

# 2. Variables de entorno
cp .env.example .env
# Editar .env con credenciales de Meta/DB

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Migrar base de datos
alembic upgrade head

# 5. Correr servicios con Docker
docker-compose up -d

# 6. Verificar salud
curl http://localhost:8000/api/health/readiness
curl http://localhost:8002/health
```

### Desarrollo Local Sin Docker

Configura credenciales y base reales antes de arrancar. Si quieres aislar tu entorno local, crea `.env.local` en la raíz del repo; `scripts/run_api_server.py` lo carga con prioridad sobre `.env`.

Variables mínimas obligatorias para la API:

```bash
DATABASE_URL=sqlite:///./sentinel_health_local_sqlite.db
JWT_SECRET=<secreto-real>
GATEWAY_API_KEY=<clave-interna-real>
BRAIN_API_KEY=<clave-interna-real>
```

```bash
# Terminal 1: API (Windows)
python scripts/run_api_server.py

# Terminal 1 alternativa: API (Linux/macOS)
cd api
uvicorn app.main:app --reload --port 8000

# Terminal 2: Brain
cd brain
python main.py

# Terminal 3: Gateway
cd whatsapp_gateway
uvicorn app.main:app --reload --port 8002

# Terminal 4: Redis (si no está en Docker)
redis-server
```

### Python del Proyecto (Windows)

Si quieres evitar depender del `python` global de tu shell, usa el wrapper del repo:

```powershell
# Verificar el Python activo del proyecto
powershell -ExecutionPolicy Bypass -File scripts/project-python.ps1

# Correr la API con el .venv del proyecto
powershell -ExecutionPolicy Bypass -File scripts/project-python.ps1 scripts/run_api_server.py

# Correr tests
powershell -ExecutionPolicy Bypass -File scripts/project-python.ps1 -m pytest tests/unit/test_clinical_pipeline.py -q
```

Este script siempre usa `.\.venv\Scripts\python.exe` desde la raíz del repo.

### Arranque Rápido Frontend + Backend (Windows)

```powershell
# Levantar API + frontend
powershell -ExecutionPolicy Bypass -File scripts/start_frontend_backend.ps1

# Detener API + frontend (puertos 8000 y 5174)
powershell -ExecutionPolicy Bypass -File scripts/stop_frontend_backend.ps1
```

### Launcher Universal (Windows)

Desde la raiz del repo puedes levantar Frontend + API + Gateway + Brain con un solo comando:

```powershell
powershell -ExecutionPolicy Bypass -File .\start_all.ps1

# API + SPA + SSR selectivo en un solo comando
powershell -ExecutionPolicy Bypass -File .\start_all.ps1 -EnableSSR
```

Tambien puedes usar el wrapper cmd:

```cmd
start_all.cmd
```

SSR selectivo por entorno:

```powershell
$env:SSR_ROUTES = "/,/dashboard"
powershell -ExecutionPolicy Bypass -File .\start_all.ps1 -EnableSSR
```

---

## 📚 API Endpoints

### Pacientes

```bash
# Crear paciente
POST /api/v1/patients
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "phone": "+34612345678"
}

# Obtener paciente
GET /api/v1/patients/{id}

# Listar pacientes
GET /api/v1/patients?skip=0&limit=10

# Actualizar paciente
PUT /api/v1/patients/{id}

# Eliminar paciente
DELETE /api/v1/patients/{id}
```

### Doctores

```bash
# Similar a pacientes
POST /api/v1/doctors
GET /api/v1/doctors
GET /api/v1/doctors/{id}
GET /api/v1/doctors/specialty/{specialty}
PUT /api/v1/doctors/{id}
DELETE /api/v1/doctors/{id}
```

### Salud

```bash
# Readiness check
GET /api/health/readiness

# Liveness check
GET /api/health/liveness
```

---

## 🧠 Flujo de Ejemplo: Crear Cita por WhatsApp

1. **Usuario envía mensaje a WhatsApp:**  
   `"Quiero cita con cardiólogo mañana a las 10am"`

2. **WhatsApp Gateway recibe webhook:**
   - Valida firma HMAC de Meta
   - Parsea mensaje
   - **Encola en Redis** (retorna 200 inmediatamente ✅)

3. **Brain Worker consume de cola:**
   - NLP analiza intención
   - Extrae: specialty=Cardiología, fecha=mañana, hora=10am
   - Decision Engine busca doctor disponible

4. **Brain llama API interna:**
   ```
   POST /api/v1/appointments
   {
     "patient_id": 1,
     "doctor_id": 5,
     "appointment_date": "2026-04-02T10:00:00",
     "reason": "Consulta general"
   }
   ```

5. **API crea cita en DB:**
   - Valida disponibilidad del doctor
   - Persiste en PostgreSQL
   - Retorna `201 Created`

6. **Brain encola respuesta para usuario:**
   - "✅ Tu cita confirmada para mañana a las 10am con Dr. Fernando"

7. **Gateway envía mensaje por WhatsApp:** ✅

---

## 🔐 Configuración de WhatsApp

1. **Meta Developer Portal:**
   - Crear Business Account
   - Configurar WhatsApp Business API
   - Obtener: `PHONE_NUMBER_ID`, `ACCESS_TOKEN`, `VERIFY_TOKEN`

2. **Archivo `.env`:**
   ```env
   WHATSAPP_PHONE_NUMBER_ID=your_phone_id
   WHATSAPP_ACCESS_TOKEN=your_access_token
   WHATSAPP_VERIFY_TOKEN=your_verify_token
   ```

3. **Configurar Webhook en Meta:**
   ```
   Webhook URL: https://your-domain/webhook/whatsapp
   Verify Token: (mismo que WHATSAPP_VERIFY_TOKEN)
   ```

---

## 📦 Estructura del Proyecto

```
GSentinelHealthOS/
├── shared/              # ← ÚNICA FUENTE DE VERDAD
│   ├── models/          # SQLAlchemy ORM
│   ├── schemas/         # Pydantic validators
│   └── utils/           # Logging, helpers
│
├── api/                 # Backend REST (CRUD)
├── brain/               # Worker IA (Async)
├── whatsapp_gateway/    # Webhooks de Meta
├── database/            # Migrations, init scripts
├── docker/              # Dockerfiles
├── tests/               # Unit + Integration tests
├── docs/                # Documentación
└── requirements.txt
```

---

## 🧪 Pruebas

### Unitarias

```bash
# Pruebas de servicios
pytest tests/unit/ -v
```

### Integración

```bash
# Pruebas E2E: GW → Brain → API
pytest tests/integration/ -v
```

### Seed de usuarios (OAuth2/RBAC)

```bash
# Validar wiring de migración + seed
python scripts/validate_seed_users.py

# Aplicar seed idempotente (requiere credenciales por entorno)
python scripts/seed_users.py

# Procesar outbox de notificaciones (n8n)
python scripts/process_notification_outbox.py

# Ejecutar test de confiabilidad outbox en Python 3.11 (tox)
tox -e py311-outbox
```

### CI de confiabilidad (Outbox)

El workflow [outbox-reliability.yml](.github/workflows/outbox-reliability.yml) ejecuta
automáticamente el test de outbox en Python 3.11 para evitar falsos negativos del entorno local.

### Cobertura

```bash
pytest --cov=api --cov=brain --cov=whatsapp_gateway
```

---

## 🔍 Debugging

### Ver logs en tiempo real

```bash
# Docker
docker-compose logs -f api brain gateway

# Local
# Usa setup_logger() de shared.utils - todos los logs van a stdout
```

### Verificar cola de Redis

```bash
redis-cli
> LLEN whatsapp:incoming
> LPOP whatsapp:incoming  # Ver primer mensaje
```

### Health checks

```bash
# API
curl http://localhost:8000/api/health/readiness

# Gateway
curl http://localhost:8002/health
```

---

## 📊 Monitoreo

### Prometheus + Grafana (futuro)

```bash
# Dashboards para:
# - Latencia de endpoints
# - Tasa de procesamiento de Brain
# - Tamaño de colas Redis
# - Error rates
```

---

## 🚨 Escalabilidad

### Cuellos de botella

- **DB:** Usa índices en email, specialty, appointment_date
- **Redis:** Aumenta memoria o usa Sentinel mode
- **Brain:** Corre múltiples instancias consumiendo la misma cola

### Configuración para producción

```yaml
# docker-compose.yml - agregar replicas
brain:
  deploy:
    replicas: 3  # Múltiples workers

redis:
  # Usar Redis Sentinel o Cluster

postgres:
  # Usar managed service (RDS, Cloud SQL)
```

---

## 📝 Variables de Entorno

Copiar `.env.example` a `.env`:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/sentinel

# Redis
REDIS_URL=redis://localhost:6379

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_VERIFY_TOKEN=...

# Environment
ENV=production
LOG_LEVEL=INFO
```

---

## 🤝 Contribuir

1. Fork el repositorio
2. Crea rama: `git checkout -b feature/tu-feature`
3. Commit cambios: `git commit -m "feat: descripción"`
4. Push: `git push origin feature/tu-feature`
5. PR a `main`

---

## 📄 Licencia

MIT License - Ver [LICENSE](LICENSE)

---

## 📞 Soporte

- 📧 Email: support@sentinelhealth.com
- 💬 Slack: [Canal #support](https://sentinelhealth.slack.com)
- 🐛 Issues: [GitHub Issues](../../issues)

---

## 🎓 Recursos

- [Documentación Completa](docs/architecture.md)
- [Decisiones de Arquitectura](docs/decisions.md)
- [API Spec](docs/api_spec.md)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Meta WhatsApp API](https://developers.facebook.com/docs/whatsapp)

---

**Made with ❤️ by GSentinelHealthOS Team**
