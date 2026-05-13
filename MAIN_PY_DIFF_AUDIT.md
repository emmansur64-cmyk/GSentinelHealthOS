# MAIN_PY_DIFF_AUDIT.md

**Fecha de auditoría:** 2026-05-12  
**Auditor:** Arquitecto Runtime Python/FastAPI  
**Archivo auditado:** `api/app/main.py`  
**Rama activa:** `GsentinelH`  
**Estado:** UNSTAGED (no commiteado)

---

## 1. RESUMEN EJECUTIVO

El diff de `api/app/main.py` contiene **108 inserciones y 5 eliminaciones** (113 líneas totales afectadas) distribuidas en **tres categorías funcionales mezcladas**: seguridad/auth, integración runtime/MetaBrain y correcciones de encoding de texto.

**El riesgo crítico más inmediato es que los dos módulos que `main.py` ahora importa son archivos UNTRACKED** (no existen en el historial git):

- `api/app/services/rate_limit.py` → `??` en `git status`
- `api/app/runtime_integration.py` → `??` en `git status`

Si `main.py` fuera commiteado sin estos archivos, el servidor fallaría con `ImportError` al iniciar. Esto constituye un **NO-GO** absoluto para cualquier commit de `main.py` aislado.

Los cambios NO son separables sin trabajo previo de preparación de los módulos dependientes.

---

## 2. TAMAÑO REAL DEL DIFF

```
api/app/main.py | 113 +++++++++++++++++++++++++++++++++++++++---
1 file changed, 108 insertions(+), 5 deletions(-)
```

| Métrica | Valor |
|---|---|
| Líneas insertadas | 108 |
| Líneas eliminadas | 5 |
| Bloques funcionales detectados | 9 |
| Archivos dependientes untracked | 2 |
| Módulos de config afectados | `redis_url`, `rate_limit_per_minute` (ya existen en settings) |

---

## 3. CLASIFICACIÓN COMPLETA DE BLOQUES

### Bloque 1 — Imports FastAPI base
**Líneas diff:** ~2  
**Categoría:** D (Auth/Security) + infraestructura  
**Cambios:**
```python
# ANTES
from fastapi import FastAPI
# DESPUÉS
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
```
**Propósito:** Soporte para middleware de rate limit, CSRF y security headers.  
**Riesgo:** Bajo. Cambios aditivos compatibles.  
**Commit separado:** NO — demasiado pequeño; va junto con el bloque de seguridad.  
**Clasificación:** `CAUTION` (mezclado en bloque con imports runtime)

---

### Bloque 2 — Import `settings` adelantado + imports runtime_integration y rate_limit
**Líneas diff:** ~7  
**Categoría:** MEZCLA — A (Runtime/pre-canary) + D (Auth/Security)  
**Cambios:**
```python
from api.app.core import settings  # movido hacia arriba (refactor menor)
from api.app.runtime_integration import (
    initialize_runtime_integration_state,
    passive_runtime_integration_middleware,
)
from api.app.services.rate_limit import RedisRateLimiter, build_redis_rate_limiter
from api.app.core.security import AUTH_COOKIE_NAME, AUTH_CSRF_COOKIE_NAME
```
**Propósito:** Dos responsabilidades distintas en el mismo bloque import.  
**Riesgo:** ALTO — `runtime_integration` y `rate_limit` son UNTRACKED. Si se commitea main.py sin estos módulos → `ImportError` en startup.  
**Commit separado:** SÍ — debe haber un commit por dominio, pero el bloque físico los mezcla.  
**Clasificación:** `NO-GO` como bloque único. Requiere que los módulos dependientes sean commiteados primero.

---

### Bloque 3 — Correcciones de encoding UTF-8
**Líneas diff:** ~3  
**Categoría:** F (Refactor accidental / deuda técnica)  
**Cambios:**
```python
# "Sistema de gesti├│n de citas m├®dicas"  →  "Sistema de gestión de citas médicas"
# "Lee or├¡genes permitidos"  →  "Lee orígenes permitidos"
# "Permite env├¡o de cookies"  →  "Permite envío de cookies"
```
**Propósito:** Corrección de corrupción de caracteres UTF-8 en strings descriptivos.  
**Riesgo:** Muy bajo. No afecta lógica ni comportamiento.  
**Commit separado:** Idealmente sí (`chore(encoding): fix UTF-8 corruption in comments`), aunque su impacto es mínimo.  
**Clasificación:** `GO`

---

### Bloque 4 — Funciones helper de rate limit y CSRF
**Líneas diff:** ~15  
**Categoría:** D (Auth/Security)  
```python
def _request_identity(request: Request) -> str: ...
def _is_rate_limit_exempt(path: str) -> bool: ...
def _is_csrf_exempt(path: str) -> bool: ...
```
**Propósito:** Helpers para extracción de IP real (con soporte `X-Forwarded-For`) y listas de exención.  
**Riesgo:** MEDIO.  
- `_request_identity`: El orden de confianza de `X-Forwarded-For` asume que hay un reverse proxy confiable adelante. Si el API estuviera expuesto directamente, este header sería falsificable → spoofing de IP para evadir rate limit. **Requiere confirmar topología de red.**
- `_is_csrf_exempt`: La lista de paths exentos puede ser incompleta. Cualquier webhook nuevo no listado recibirá CSRF enforcement si tiene cookie de auth.  
**Commit separado:** Va junto con los middleware de seguridad.  
**Clasificación:** `CAUTION`

---

### Bloque 5 — `rate_limit_middleware`
**Líneas diff:** ~25  
**Categoría:** D (Auth/Security)  
**Propósito:** Middleware de rate limiting por IP via Redis. Degradación graciosa si Redis no disponible (limiter=None → pasa).  
**Riesgo:** MEDIO-ALTO.  
- Degradación graciosa está implementada ✓
- Depende de `api/app/services/rate_limit.py` (UNTRACKED) ✗
- Si `rate_limit_per_minute` en `.env` no está definido, usa default 200 req/min ✓  
**Commit separado:** SÍ, como parte del commit de seguridad.  
**Clasificación:** `CAUTION` (módulo dependiente debe commitearse primero)

---

### Bloque 6 — `security_headers_middleware`
**Líneas diff:** ~10  
**Categoría:** D (Auth/Security)  
**Propósito:** Headers de seguridad HTTP estándar (X-Frame-Options, HSTS, etc.).  
**Riesgo:** BAJO-MEDIO.  
- HSTS con `max-age=31536000` puede causar problemas en entornos de dev/test si se accede por HTTP. Verificar que solo aplica en producción o que el entorno usa HTTPS.  
- `X-Frame-Options: DENY` podría afectar iframes embebidos si los hubiera.  
**Commit separado:** Va junto con el commit de seguridad.  
**Clasificación:** `CAUTION`

---

### Bloque 7 — `csrf_middleware`
**Líneas diff:** ~15  
**Categoría:** D (Auth/Security)  
**Propósito:** Protección CSRF para endpoints con cookie auth. Solo aplica si la cookie `AUTH_COOKIE_NAME` está presente.  
**Riesgo:** MEDIO.  
- Clientes que usan Bearer token (Authorization header, sin cookie) NO son afectados ✓  
- El path `/api/v1/auth/token` (login endpoint) está exento ✓  
- Depende de `AUTH_COOKIE_NAME` y `AUTH_CSRF_COOKIE_NAME` desde `api/app/core.security` — ya commiteado ✓  
- El path `/api/v1/auth/logout` está exento — verificar si logout requiere autenticación y si la exención es intencional o un gap.  
**Commit separado:** Va junto con el commit de seguridad.  
**Clasificación:** `CAUTION`

---

### Bloque 8 — Middleware registration + runtime hook
**Líneas diff:** ~3  
**Categoría:** MEZCLA — A (Runtime) + D (Security)  
```python
app.add_middleware(IdempotencyMiddleware)
register_exception_handlers(app)
app.middleware("http")(passive_runtime_integration_middleware)  # ← NUEVO
```
**Propósito:** Registro del middleware pasivo de integración runtime/MetaBrain.  
**Riesgo:** MEDIO. `passive_runtime_integration_middleware` es UNTRACKED. El orden de registro de middlewares en FastAPI es inverso (LIFO) — debe verificarse que este middleware no interfiera con rate limit o CSRF.  
**Commit separado:** SÍ, va con el commit de runtime/MetaBrain.  
**Clasificación:** `CAUTION`

---

### Bloque 9 — Startup/Shutdown additions
**Líneas diff:** ~16  
**Categoría:** MEZCLA — A (Runtime) + D (Security)  
```python
# STARTUP
initialize_runtime_integration_state(app)           # Runtime/MetaBrain
app.state.rate_limiter = await build_redis_rate_limiter(...)   # Security
app.state.auth_rate_limiter = await build_redis_rate_limiter(...)  # Security

# SHUTDOWN
await limiter.close()        # Security
await auth_limiter.close()   # Security
```
**Propósito:** Inicialización de estado runtime + inicialización de rate limiters Redis + limpieza en shutdown.  
**Riesgo:** ALTO como bloque mezclado.  
- Si `build_redis_rate_limiter` falla en startup (Redis no disponible) puede bloquear el startup completo del servidor.  
- `initialize_runtime_integration_state` depende de `runtime_integration.py` (UNTRACKED).  
- Ambas responsabilidades están en el mismo hook — difícil hacer rollback parcial.  
**Commit separado:** Requiere split en commits distintos, pero físicamente están en la misma función.  
**Clasificación:** `NO-GO` como bloque mezclado. Requiere refactor para separar hooks o commitear todo junto con todos los módulos dependientes.

---

## 4. RESUMEN DE RIESGOS

| # | Riesgo | Severidad | Bloque |
|---|---|---|---|
| R1 | `rate_limit.py` UNTRACKED — ImportError en startup si se commitea main.py solo | CRÍTICO | Bloques 2, 5, 9 |
| R2 | `runtime_integration.py` UNTRACKED — ImportError en startup si se commitea main.py solo | CRÍTICO | Bloques 2, 8, 9 |
| R3 | `X-Forwarded-For` confiado incondicionalmente — IP spoofing posible si API expuesta directamente | ALTO | Bloque 4 |
| R4 | HSTS activo en todos los entornos — puede romper dev/test sobre HTTP | MEDIO | Bloque 6 |
| R5 | Startup hook mezclado — fallo en rate limiter bloquea también init de runtime | MEDIO | Bloque 9 |
| R6 | Lista CSRF exempt incompleta — nuevos webhooks pueden romperse | MEDIO | Bloque 4, 7 |
| R7 | Orden LIFO de middleware — `passive_runtime_integration_middleware` puede interferir | BAJO-MEDIO | Bloque 8 |
| R8 | `settings.rate_limit_per_minute` no definido en `.env` usa default 200 — puede ser insuficiente | BAJO | Bloque 9 |

---

## 5. BLOQUES MEZCLADOS (MEZCLAS PELIGROSAS)

| Bloque | Mezcla detectada | Impacto en rollback |
|---|---|---|
| Imports (Bloque 2) | Runtime + Security en mismo bloque import | No separable sin editar el archivo |
| Registro middleware (Bloque 8) | Runtime middleware entre bloques de seguridad | Rollback de seguridad dejaría runtime colgado |
| Startup hook (Bloque 9) | `initialize_runtime_integration_state` + `build_redis_rate_limiter` en misma función | Fallo de uno bloquea al otro |
| Shutdown hook (Bloque 9) | Cierre de rate limiters + DB engine en misma función | No crítico, todos son cleanup |

**Diagnóstico:** La mezcla más peligrosa es el startup hook. Si se hace rollback del rate limiter (ej. problema con Redis), se necesita también remover `initialize_runtime_integration_state` del mismo hook, lo que puede impactar funcionalidad MetaBrain.

---

## 6. CAMBIOS CRÍTICOS

1. **ImportError garantizado si se commitea main.py sin módulos dependientes** — Los archivos `api/app/services/rate_limit.py` y `api/app/runtime_integration.py` son `??` en git status (completamente untracked). No existen en ningún commit.

2. **Tres middlewares HTTP nuevos** — Se agregan a la cadena LIFO de FastAPI. El orden efectivo de ejecución será:
   ```
   passive_runtime_integration_middleware  (último registrado → primero ejecutado)
   csrf_middleware
   security_headers_middleware
   rate_limit_middleware
   IdempotencyMiddleware
   CORSMiddleware
   ```
   Este orden puede tener implicaciones no auditadas (ej. CORS aplicado después de rate limit podría devolver 429 sin headers CORS en preflight).

3. **Redis requerido en startup** — `build_redis_rate_limiter` conecta a Redis durante startup. Si Redis no está disponible, el comportamiento depende de la implementación en `rate_limit.py` (UNTRACKED, no auditado completamente).

---

## 7. CAMBIOS NO-GO

| NO-GO | Razón |
|---|---|
| Commitear `main.py` solo, sin `rate_limit.py` | ImportError inmediato en startup del servidor |
| Commitear `main.py` solo, sin `runtime_integration.py` | ImportError inmediato en startup del servidor |
| Commitear `main.py` como bloque único mezclado sin test previo | Mezcla de dominios impide rollback limpio |
| Deploy a producción antes de auditar `rate_limit.py` y `runtime_integration.py` | Módulos críticos sin historial git, sin revisión de seguridad |

---

## 8. ESTRATEGIA SEGURA DE SEPARACIÓN

La separación no puede ser solo de `main.py`. Requiere preparar los módulos dependientes primero.

### Pre-condición obligatoria
Auditar y stagear `api/app/services/rate_limit.py` y `api/app/runtime_integration.py` antes de cualquier commit de `main.py`.

### Separación propuesta en 3 commits

#### Commit A — `chore(encoding): fix UTF-8 corruption in main.py comments`
- Solo las 3 líneas de corrección de encoding en description y comentarios CORS.
- No cambia imports ni lógica.
- Completamente aislable con `git add -p`.
- **Riesgo:** NULO.

#### Commit B — `feat(security): add rate-limiting, CSRF and security-headers middleware`
Archivos:
- `api/app/services/rate_limit.py` (staging completo, UNTRACKED)
- `api/app/main.py` — solo los bloques de seguridad:
  - Imports `Request`, `JSONResponse`, `RedisRateLimiter`, `AUTH_COOKIE_NAME`, `AUTH_CSRF_COOKIE_NAME`
  - Funciones helper `_request_identity`, `_is_rate_limit_exempt`, `_is_csrf_exempt`
  - Middleware `rate_limit_middleware`, `security_headers_middleware`, `csrf_middleware`
  - Startup: solo `build_redis_rate_limiter` x2
  - Shutdown: `limiter.close()` y `auth_limiter.close()`
- **Riesgo pre-commit:** Verificar que `build_redis_rate_limiter` no falla si Redis no disponible.
- **Tests requeridos:** Probar endpoints con y sin Redis disponible. Probar CSRF en flow completo de login/acción.

#### Commit C — `feat(runtime): integrate passive MetaBrain runtime middleware`
Archivos:
- `api/app/runtime_integration.py` (staging completo, UNTRACKED)
- `api/app/main.py` — solo los bloques runtime:
  - Import `initialize_runtime_integration_state`, `passive_runtime_integration_middleware`
  - Registro: `app.middleware("http")(passive_runtime_integration_middleware)`
  - Startup: `initialize_runtime_integration_state(app)`
- **Riesgo pre-commit:** Verificar comportamiento si MetaBrain no está disponible.
- **Tests requeridos:** Probar que el middleware es verdaderamente pasivo y no bloquea requests normales.

---

## 9. ORDEN RECOMENDADO DE COMMITS FUTUROS

```
[ACTUAL HEAD] 6d441c1 chore(security): mitigate npm audit vulnerabilities safely
      ↓
[PRE-CONDICIÓN] Auditar rate_limit.py y runtime_integration.py (UNTRACKED)
      ↓
Commit A: chore(encoding): fix UTF-8 corruption in main.py comments
      ↓
Commit B: feat(security): add rate-limiting, CSRF and security-headers middleware
          (incluye api/app/services/rate_limit.py + porción security de main.py)
      ↓
      [TEST POINT — verificar que API arranca correctamente con y sin Redis]
      ↓
Commit C: feat(runtime): integrate passive MetaBrain runtime middleware
          (incluye api/app/runtime_integration.py + porción runtime de main.py)
      ↓
      [TEST POINT — verificar que MetaBrain middleware no afecta latencia ni errors]
      ↓
[LISTO PARA PUSH]
```

**NO mezclar B y C** — tienen dominios distintos y riesgos distintos de rollback.

---

## 10. RIESGOS DE ROLLBACK

| Escenario | Riesgo | Mitigación |
|---|---|---|
| Rollback de Commit C (runtime) | Bajo — `passive_runtime_integration_middleware` es pasivo por diseño. Remover su registro es seguro. | Probar ausencia de errores en logs |
| Rollback de Commit B (security) | Medio — Remover rate limiter y CSRF puede re-exponer vectores de ataque | Evaluar si el trigger fue Redis failure o lógica de middleware |
| Rollback del bloque startup mezclado | Alto — Difícil separar `initialize_runtime_integration_state` de `build_redis_rate_limiter` si están en mismo hook | La estrategia de separación en Commits B y C resuelve esto |
| Rollback parcial con archivos UNTRACKED ya eliminados | CRÍTICO — `rate_limit.py` y `runtime_integration.py` son untracked; un `git checkout` no los restaura | **NUNCA eliminar estos archivos del disco hasta que sean commiteados** |
| Deploy a producción con mezcla actual | NO-GO — Módulos sin historial, startup hooks mezclados, HSTS permanente | Seguir orden de commits propuesto |

---

## ESTADO DEL WORKTREE

```
Estado actual:   UNSTAGED — diff preservado íntegramente
Archivos en riesgo de pérdida:
  ?? api/app/services/rate_limit.py     ← UNTRACKED, NO hacer rm ni git clean
  ?? api/app/runtime_integration.py     ← UNTRACKED, NO hacer rm ni git clean
Acción recomendada inmediata: NINGUNA. Solo auditoría.
Próxima acción segura: Auditar contenido de rate_limit.py y runtime_integration.py
                       antes de iniciar separación de commits.
```

---

*Auditoría generada por análisis directo de `git diff -- api/app/main.py` sin modificar el worktree.*
