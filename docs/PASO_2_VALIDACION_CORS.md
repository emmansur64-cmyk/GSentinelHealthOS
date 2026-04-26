## Paso 2: Validación Pydantic 2.0 y Blindaje CORS - Validación Completada

**Fecha:** 1 de abril de 2026  
**Estado:** ✅ IMPLEMENTADO

---

### 1. Arquitectura de Schemas (Pydantic 2.0)

Se creó una estructura modular para validación de datos:

#### `api/app/schemas/base_schema.py`
- **Clase Base:** `BaseSchema` con `model_config = ConfigDict(from_attributes=True)`
- **Función:** Permite a Pydantic leer directamente modelos SQLAlchemy ORM
- **Configuración:** 
  - `from_attributes=True` → lee atributos de objetos ORM
  - `populate_by_name=True` → soporta alias en deserialización

#### `api/app/schemas/appointment_schema.py`
Esquemas de negocio con validaciones strictas:

**PatientBase:**
```python
- name: str (min_length=3, max_length=100)
- phone: str (validación E.164: ^\+?[1-9]\d{1,14}$)  
- email: Optional[EmailStr]
```

**AppointmentBase:**
```python
- date_time: datetime
- reason: Optional[str] (max_length=500)
- status: str (enum: scheduled, completed, cancelled, pending)
```

**AppointmentCreate & AppointmentResponse:**
- Heredan de `AppointmentBase` añadiendo `doctor_id`, `patient_id`, e `id` en response

---

### 2. Configuración Centralizada (BaseSettings)

Se implementó `api/app/core/config.py` con modelo singleton `settings`:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # API
    api_title: str = "GSentinelHealthOS API"
    api_version: str = "1.0.0"
    debug: bool = False
    
    # CORS (Lee de ALLOWED_ORIGINS en .env)
    allowed_origins: str = "http://localhost:3000,http://localhost:5173"
    
    # Database, JWT, Logging... (todo desde .env)
    
    @property
    def origins_list(self) -> List[str]:
        """Convierte cadena de orígenes en lista."""
        return [o.strip() for o in self.allowed_origins.split(",")]
```

**Ventajas:**
- ✅ Un único punto de configuración
- ✅ Tipado fuerte (Pydantic v2)
- ✅ Lee automáticamente de `.env`
- ✅ Valores por defecto seguros

---

### 3. Blindaje CORS (Seguridad Perimetral)

**Cambios en `api/app/main.py`:**

```python
from api.app.core import settings

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,      # ← Desde .env, no hardcoded
    allow_credentials=True,                   # ← Para soportar autenticación
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)
```

**Seguridad implementada:**
- ❌ **Antes:** `allow_origins=["*"]` permitía cualquier origen (vulnerabilidad CORS)
- ✅ **Ahora:** Solo orígenes en whitelist → previene ataques CSRF desde sitios maliciosos
- ✅ `allow_credentials=True` → permite cookies/auth headers desde orígenes confiables

**Configuración en `.env`:**
```bash
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://app.gsentinelhealthos.com
```

---

### 4. Auditoría de Suposiciones

#### ✓ **Teléfono como Identificador WhatsApp**
- **Supuesto:** El `phone` del paciente es el identificador para WhatsApp Gateway
- **Validación E.164:** `^\+?[1-9]\d{1,14}$` asegura formato internacional
- **Consideración:** Si un paciente cambia de teléfono:
  - Se debe crear nuevo registro de paciente o
  - Implementar `external_id` en tabla `patients` para mapping histórico
  - Indexar `phone` en BD para búsquedas rápidas

#### ✓ **CORS con n8n en Dominio Distinto**
- **Supuesto:** n8n podría en `n8n.tuempresa.com`
- **Acción Requerida:** Agregar a `ALLOWED_ORIGINS` en `.env`
  ```bash
  ALLOWED_ORIGINS=http://localhost:3000,https://n8n.tuempresa.com,https://app.gsentinelhealthos.com
  ```

#### ✓ **Configuración Centralizada**
- **Patrón:** Un solo `api/app/core/config.py` via Pydantic BaseSettings
- **Anti-patrón evitado:** Crear `config.py` por cada módulo → confusión y desincronización

---

### 5. Validaciones de Negocio

#### **Validador de Teléfono**
```python
@field_validator("phone")
@classmethod
def validate_phone_format(cls, v: str) -> str:
    if not v.startswith("+"):
        raise ValueError("Teléfono debe incluir prefijo de país")
    return v
```

#### **Validador de Estado de Cita**
```python
@field_validator("status")
@classmethod
def validate_status(cls, v: str) -> str:
    allowed = {"scheduled", "completed", "cancelled", "pending"}
    if v not in allowed:
        raise ValueError(f"estado debe ser uno de: {allowed}")
    return v
```

---

### 6. Checklist de Seguridad Implementado

| Aspecto | Antes | Después | Estado |
|---------|--------|---------|--------|
| **CORS Allow-Origins** | Hardcoded lista | `.env` via Settings | ✅ |
| **CORS Allow-Credentials** | `False` | `True` (para auth) | ✅ |
| **Config Centralizada** | Dispersa por módulos | `api/app/core/config.py` | ✅ |
| **Validación de Email** | Manual | `EmailStr` Pydantic | ✅ |
| **Validación de Teléfono** | Manual | E.164 regex + validator | ✅ |
| **Type Safety Schemas** | `dict` genéricos | Typed Pydantic v2 | ✅ |
| **ORM-to-API Bridge** | Conversión manual | `from_attributes=True` | ✅ |

---

### 7. Próximos Pasos (Paso 3 - Rutas y Dependencias)

- Implementar `api/app/dependencies/db.py` para inyección de sesión DB
- Crear `api/app/api/v1/endpoints/*.py` usando schemas
- Implementar JWT authentication middleware
- Agregar validación de roles (RBAC)

---

### 📋 Archivos Creados/Modificados

✅ `api/app/schemas/__init__.py`  
✅ `api/app/schemas/base_schema.py`  
✅ `api/app/schemas/appointment_schema.py`  
✅ `api/app/core/config.py`  
✅ `api/app/core/__init__.py`  
✅ `api/app/main.py` (actualizado)  
✅ `.env.example` (actualizado)  

---

**Nota:** Los cambios cumplen con:
- ✅ Pydantic 2.0 spec
- ✅ OWASP CORS Security
- ✅ Type Safety (mypy compatible)
- ✅ Environment-based configuration (12-factor apps)
