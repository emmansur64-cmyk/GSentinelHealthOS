# RESUMEN EJECUTIVO - AUDITORÍA METABRAIN SEPARATION

## Matriz de Decisión Rápida

```
¿SEPARAR METABRAIN EN MB-CHAT, MB-SECRETARÍA, MB-WHATSAPP?

╔════════════════════════════════════════════════════════════════╗
║                         SÍ, ES VIABLE                          ║
║                   (Con Condiciones Críticas)                    ║
╚════════════════════════════════════════════════════════════════╝

PERO:
  ⚠️  medical-agenda-saas viola arquitectura (acceso Prisma directo)
  ⚠️  Brain debe ser CENTRALIZADO (no duplicar 3 veces)
  ⚠️  Webhook redundante debe eliminarse
  ⚠️  Scopes de API Keys no validados en endpoints
```

---

## Análisis de Componentes (Evidencia Real)

### 1. WhatsApp Gateway ✅ LISTO

```
whatsapp_gateway/
├── api/routes/webhook.py          ✅ Desacoplado
├── app/main.py                    ✅ FastAPI separada
├── services/account_resolver.py   ✅ Tenant isolation
└── Importa: shared/ SOLO (config, security, utils)

NO importa brain, NO importa api.app
COMUNICACIÓN: Redis queue → API

VEREDICTO: Puede estar en contenedor separado HOY
```

---

### 2. Brain ✅ LISTO

```
brain/
├── app.py                          ✅ FastAPI separada
├── contracts/routing.py            ✅ Contratos formales
├── core/decision_core.py           ✅ Lógica determinística
├── integration/api_client.py       ✅ HTTP client a API
└── Importa: shared/ + brain/ internamente

NO importa api.app directamente, NO importa whatsapp_gateway
COMUNICACIÓN: HTTP + X-Internal-Key → API

VEREDICTO: Puede estar en contenedor separado HOY
```

---

### 3. API Core ✅ LISTO

```
api/
├── app/main.py                     ✅ FastAPI
├── api/v1/endpoints/               ✅ Endpoints con auth
├── core/security.py                ✅ Hybrid auth (API Key + JWT)
├── dependencies/auth.py            ✅ RBAC guards
├── dependencies/tenant.py          ✅ Multi-tenancy
├── services/                       ✅ Business logic
└── models/                         ✅ SQLAlchemy ORM

Importa: shared/ + api/ internamente, acceso HTTP desde brain/whatsapp_gateway

VEREDICTO: Puede estar en contenedor separado HOY
```

---

### 4. ❌ PROBLEMA CRÍTICO: medical-agenda-saas

```
medical-agenda-saas/
├── src/repositories/               ❌ Prisma directo
│   └── appointmentRepository.ts   
│       └── tx.patient.findFirst()
│       └── tx.appointment.create()
│       └── tx.availabilityRule.findFirst()
├── src/services/appointmentEngine.ts  ❌ Acceso BD directo
└── NO usa api.app endpoints

ACCESO DIRECTO A BD (Prisma):
  - SIN pasar por api.app/endpoints
  - SIN validar guards de RBAC
  - SIN pasar por tenant context
  - SIN auditoria centralizada

BLOQUEADOR: No puede separarse sin reescribir
```

---

### 5. ⚠️ PROBLEMA MEDIANO: Webhook Redundante

```
OPCIÓN 1 (CORRECTO):
  whatsapp_gateway/api/routes/webhook.py
  └─ Valida firma, encolá, fallback seguro ✅

OPCIÓN 2 (REDUNDANTE):
  api/app/api/v1/endpoints/webhooks_whatsapp.py
  └─ TAMBIÉN valida, TAMBIÉN intenta responder ⚠️
  └─ Genera confusión de responsabilidades
  └─ Si se duplican, tendrías 3+ webhooks

RECOMENDACIÓN: Eliminar opción 2
```

---

## Matriz de Separación

```
                    HOY            FÁCIL           DIFÍCIL
                    
whatsapp_gateway    ✅ Desacoplado ✅ Separable    -
brain               ✅ Desacoplado ✅ Separable    -
api                 ✅ Desacoplado ✅ Separable    -
medical-agenda-saas ❌ Acoplado    ⚠️ Refactoring  (2-3 semanas)

CONCLUSIÓN: 3/4 componentes listos, 1/4 requiere trabajo
```

---

## Contratos Compartidos Encontrados

### ✅ brain/contracts/routing.py (FORMAL)

```python
class AssistantMode(Enum):
    DOCTOR_PROFESSIONAL       # Doctor puede hacer cualquier cosa
    PATIENT_ASSISTANT        # Paciente conversacional
    PATIENT_TRIAGE           # Triage automático
    RECEPTIONIST             # Secretaría
    ADMINISTRATIVE           # Admin
    GENERIC_NON_CLINICAL     # Fallback seguro

# 5 INVARIANTES formalizadas (no son recomendaciones, son reglas)
INVARIANT A: DOCTOR_PROFESSIONAL NUNCA entra a triage automático
INVARIANT B: general_query NUNCA genera clasificación de síntomas
INVARIANT C: Triage requiere: capabilities + intent explícito + confidence + síntomas explícitos
INVARIANT D: Si falla → fallback seguro NO clínico
INVARIANT E: Pipelines DOCTOR y PATIENT son mutuamente excluyentes
```

### ✅ api/app/core/security.py (IMPLEMENTADO)

```python
API_KEY_SCOPES = {
    "gateway": [
        "appointments:create",
        "appointments:validate-slot",
        "patients:read-by-phone",
        "patients:create-shadow",
    ],
    "brain": [
        "appointments:read",
        "patients:read",
        "appointments:analyse",
    ],
}

class UserAuth:
    role: str  # "doctor", "receptionist", "admin"
    doctor_id: Optional[str]
    client_id: Optional[str]
    clinic_id: Optional[str]

class TenantContext:
    client_id: UUID | None
    clinic_id: UUID | None
```

### ✅ shared/config.py (CENTRALIZADO)

```python
DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL")
JWT_SECRET_KEY = os.getenv("JWT_SECRET")
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN")
# ... + 20 más configuraciones compartidas
```

---

## Riesgos Detectados

### 🔴 CRÍTICO

| Riesgo | Impacto | Solución |
|---|---|---|
| medical-agenda-saas acceso directo BD | Bloquea separación física | Refactorizar → API HTTP |
| Webhook redundante | Confusión de responsabilidades | Eliminar opción 2 |

### 🟠 MEDIANO

| Riesgo | Impacto | Solución |
|---|---|---|
| API Key scopes no validados | Brain puede hacer acciones no autorizadas | Agregar scope checking |
| Triage expuesto HTTP | Endpoint sin encapsulación | Mover lógica dentro brain |

### 🟡 BAJO

| Riesgo | Impacto | Solución |
|---|---|---|
| Logging sin trace IDs | Difícil debugging distribuido | Agregar trace IDs globales |
| Schemas dispersos | Duplicación potencial | Consolidar en shared/ |

---

## Recomendación de Arquitectura

### OPCIÓN A: Separación Superficial (5 días)

```
CONTENEDOR A: API + medical-agenda-saas + shared
CONTENEDOR B: Brain + shared
CONTENEDOR C: WhatsApp + shared

RIESGO: medical-agenda-saas sigue acoplado a BD
VENTAJA: Funciona ahora mismo
```

### OPCIÓN B: Separación Segura (5-7 semanas) ⭐ RECOMENDADO

```
SEMANA 1-3: Refactorizar medical-agenda-saas
  tx.patient.findFirst() → POST /api/v1/patients/by-phone
  tx.appointment.create() → POST /api/v1/appointments
  Validar todas las queries se convierten a API calls

SEMANA 4: Consolidar Agenda API
  Mover routes a api/app/api/v1/agenda/
  Documentar OpenAPI
  Pruebas E2E

SEMANA 5: Event Bus (opcional)
  Redis Streams para eventos
  MB-{X} se suscriben a eventos

RESULTADO:
  ✅ Verdadera separación
  ✅ Escalabilidad independiente
  ✅ Teams separados
  ✅ Limites técnicos claros
```

### OPCIÓN C: Mantener Monolítico

```
SI: La app escala uniformemente y es pequeña
ENTONCES: NO duplicar Brain, consolidar API, dejar como está

VENTAJA: 0 esfuerzo
DESVENTAJA: Sin limites de escalabilidad independiente
```

---

## Métricas de Madurez Arquitectónica

```
╔═══════════════════════════════════════════════════════════╗
║                  MADUREZ ACTUAL: 6.5/10                   ║
╚═══════════════════════════════════════════════════════════╝

✅ Contratos claros                    9/10
✅ Tenant isolation                    9/10
✅ Auth guards                         9/10
✅ Desacoplamiento físico              8/10
✅ Circuit breakers                    8/10
⚠️ API consolidada                     7/10
⚠️ Schemas reutilizables               5/10
⚠️ Logging centralizado                4/10
❌ Event Bus explícito                0/10

PARA AUMENTAR A 9/10:
  1. Refactorizar medical-agenda-saas (+-3 semanas)
  2. Eliminar webhook redundante (+-1 día)
  3. Agregar scope validation (+-3 días)
  4. Centralizar logging (+-1 semana)
```

---

## Decisión Final

### ¿SEPARAR O NO?

```
┌──────────────────────────────────────┐
│  SÍ, SEPARAR - PERO EN FASES        │
├──────────────────────────────────────┤
│ FASE 1: Refactorizar medical-agenda │
│ FASE 2: Consolidar Agenda API       │
│ FASE 3: Separar en repos            │
│ FASE 4: Event Bus (opcional)        │
└──────────────────────────────────────┘

TIMELINE: 5-7 semanas de esfuerzo real
RESULTADO: Arquitectura modular verdadera
EQUIPO: 2-3 ingenieros
RIESGO: BAJO (cambios incrementales)
```

---

## Checklist de Acción

- [ ] Eliminar webhook redundante (api/app/api/v1/endpoints/webhooks_whatsapp.py)
- [ ] Refactorizar medical-agenda-saas (Prisma → API HTTP)
- [ ] Agregar scope validation en api/app/core/security.py
- [ ] Consolidar Agenda API (crear api/app/api/v1/agenda/)
- [ ] Centralizar logging (trace IDs + correlation IDs)
- [ ] Agregar Event Bus (Redis Streams)
- [ ] Documentar Bounded Contexts explícitamente
- [ ] Separar en repos independientes

---

**Elaborado sin especulaciones, únicamente con evidencia técnica real del codebase.**

