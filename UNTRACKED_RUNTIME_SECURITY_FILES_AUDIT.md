# UNTRACKED_RUNTIME_SECURITY_FILES_AUDIT

**Fecha:** 2026-05-12  
**Repositorio:** E:/GSentinelHealthOS  
**Objetivo:** auditoría estática y de control de cambios sobre archivos untracked dependidos por api/app/main.py

---

## 1. Rutas exactas

- api/app/services/rate_limit.py
- api/app/runtime_integration.py
- Archivo dependiente principal: api/app/main.py

---

## 2. Estado git

Resultado de `git status --short -- api/app/services/rate_limit.py api/app/runtime_integration.py api/app/main.py`:

```text
 M api/app/main.py
?? api/app/runtime_integration.py
?? api/app/services/rate_limit.py
```

Conclusión:

- api/app/main.py sigue con diff amplio unstaged.
- api/app/runtime_integration.py está untracked.
- api/app/services/rate_limit.py está untracked.
- No es seguro commitear el diff de main.py mientras estas dependencias sigan fuera de git.

---

## 3. Dependencias desde main.py

Dependencias directas detectadas en api/app/main.py:

- `from api.app.runtime_integration import initialize_runtime_integration_state, passive_runtime_integration_middleware`
- `from api.app.services.rate_limit import RedisRateLimiter, build_redis_rate_limiter`
- Uso de `RedisRateLimiter` en middleware HTTP.
- Uso de `passive_runtime_integration_middleware` como middleware HTTP.
- Uso de `initialize_runtime_integration_state(app)` en startup.
- Uso de `build_redis_rate_limiter(...)` en startup para `rate_limiter` y `auth_rate_limiter`.

Impacto:

- Si falta api/app/services/rate_limit.py, la app puede fallar al importar main.py.
- Si falta api/app/runtime_integration.py, la app puede fallar al importar main.py.
- El riesgo no es teórico: la dependencia es de import-time, no lazy.

---

## 4. Auditoría de api/app/services/rate_limit.py

### Inventario funcional

Contenido principal:

- `RateLimitDecision` como dataclass inmutable.
- `RedisRateLimiter` con:
  - constructor que normaliza `requests` y `window_seconds`
  - `close()` para cerrar el cliente Redis
  - `evaluate(identity)` para calcular cuota y TTL
- `build_redis_rate_limiter(redis_url, requests, window_seconds)`

### Imports y dependencias externas

Imports:

- `time`
- `dataclass`
- `redis.asyncio.Redis`

Dependencias externas:

- Requiere paquete `redis` con soporte asyncio.
- Requiere conectividad a Redis para construirse correctamente.

Conclusión:

- No tiene fallback in-memory.
- No tiene modo degradado local.
- No usa DB ni providers externos distintos de Redis.

### Uso de Redis

Patrón de operación:

- arma key por ventana temporal: `gsentinel:ratelimit:{identity}:{epoch_window}`
- ejecuta `INCR`
- si el contador quedó en 1, ejecuta `EXPIRE`
- consulta `TTL`

Fortalezas:

- El contador es compartido entre workers si todos apuntan al mismo Redis.
- El límite es configurable por parámetros.
- El reset usa ventana fija simple y predecible.

Problemas detectados:

- `INCR` y `EXPIRE` no son atómicos como unidad lógica.
- Si el proceso o Redis fallan después de `INCR` y antes de `EXPIRE`, puede quedar una key sin expiración.
- No hay script Lua ni transacción para asegurar consistencia de TTL.

### Fallback y comportamiento si Redis falla

Estado actual:

- En construcción: `build_redis_rate_limiter()` hace `await redis.ping()`.
- Si Redis falla en startup, lanza excepción.
- Durante requests: `evaluate()` no captura errores Redis.
- Si Redis cae luego del startup, el middleware que llama `evaluate()` puede propagar excepción y devolver 500.

Conclusión:

- No hay fail-open controlado.
- No hay fail-closed explícito.
- Hay riesgo directo de disponibilidad.

### Thread/process safety y multi-worker

Evaluación:

- Multi-thread: el cliente Redis asyncio puede operar correctamente por request si el loop y conexión están sanos.
- Multi-process: el límite sí es global entre workers porque el estado vive en Redis.
- No hay riesgo de divergencia por worker mientras el Redis sea único.

Observación crítica:

- La seguridad del límite depende completamente de Redis disponible y estable.
- Si algún worker no inicializa su limiter, el comportamiento entre workers puede divergir.

### Keying strategy

Estado actual:

- La key depende de la `identity` recibida.
- Desde main.py esa identidad proviene de `_request_identity(request)`.
- `_request_identity` prioriza `X-Forwarded-For` y si no existe usa `request.client.host`.

Riesgos:

- Si la API recibe tráfico directo sin proxy confiable adelante, `X-Forwarded-For` es falsificable.
- Un atacante puede rotar ese header y evadir rate limiting.
- No hay validación de trusted proxy ni de hop count.
- No hay keying por tenant, user id, session id, auth subject o combinación híbrida.

Conclusión:

- El rate limiter actual no es confiable como control de seguridad duro si la red no garantiza proxy confiable.

### Headers expuestos

Expuestos por main.py usando este módulo:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` cuando bloquea

Evaluación:

- Correcto para transparencia operativa.
- No expone secretos.
- No agrega trazas sensibles.

### Logs y datos sensibles

Estado actual:

- rate_limit.py no loguea directamente.
- No expone datos sensibles por sí mismo.

### Compatibilidad dev/lab/prod

Dev/lab:

- Frágil si Redis no está disponible.
- Riesgo de bloquear startup en entornos locales incompletos.

Prod:

- Funcional si Redis está estable y detrás de proxy confiable.
- Riesgo operativo si Redis presenta cortes parciales.

### Veredicto rate_limit.py

**Clasificación:** NO-GO

Razones:

- No tolera falla de Redis durante requests.
- Puede bloquear startup por `ping()`.
- No tiene fallback in-memory ni bypass controlado.
- La identidad puede ser spoofeada si `X-Forwarded-For` no está protegido por trusted proxy.
- La expiración no es transaccional.

### Qué corregir antes de commit

- Capturar errores Redis en construcción y evaluación.
- Definir comportamiento explícito ante falla de Redis, idealmente fail-open con logging controlado en pre-canary/lab.
- Restringir confianza en `X-Forwarded-For` a proxies confiables.
- Considerar clave híbrida por IP autenticada/tenant/user cuando corresponda.
- Considerar operación atómica para contador + expiración.

### Tests necesarios

- Redis disponible: límites correctos y headers correctos.
- Redis no disponible en startup: comportamiento esperado sin tumbar la app o con fallo explícito controlado.
- Redis cae luego del startup: requests no deben degradar a 500 silencioso.
- Tráfico con y sin proxy confiable.
- Multi-worker apuntando al mismo Redis.

### Commit recomendado

- Debe ir en commit de Security dedicado.
- No debe mezclarse con runtime integration.

---

## 5. Auditoría de api/app/runtime_integration.py

### Inventario funcional

Contenido principal:

- helpers `_dataclass_to_dict` y `_safe_headers`
- `build_runtime_integration_snapshot(env=None)`
- `initialize_runtime_integration_state(app)`
- `get_runtime_integration_events(app)`
- `get_runtime_integration_event_bus_stats(app)`
- `passive_runtime_integration_middleware(request, call_next)`

### Integración con MetaBrain

Imports relevantes:

- `MetaBrain.observability_py.event_bus.InMemoryObservabilityEventBus`
- `MetaBrain.observability_py.structured_logger.build_structured_log`
- `MetaBrain.observability_py.telemetry_flags.load_observability_flags`
- `MetaBrain.observability_py.trace_context.create_trace_context`
- `MetaBrain.production_safety_py.runtime_guard.evaluate_runtime_guard`
- `MetaBrain.production_safety_py.runtime_guard.load_production_safety_config`
- `MetaBrain.production_safety_py.safe_fallback.build_safe_fallback`
- `MetaBrain.production_safety_py.startup_validator.validate_production_safety_startup`

Conclusión:

- La integración es pasiva.
- No ejecuta IA clínica.
- No invoca providers LLM.
- No llama imaging pipeline.
- No emite side effects externos directos.

### Startup hooks y shutdown hooks

Desde main.py:

- usa `initialize_runtime_integration_state(app)` en startup.
- registra `passive_runtime_integration_middleware` como middleware HTTP.

Dentro del archivo:

- No define shutdown hook.
- No abre conexiones de red persistentes.
- No necesita cierre explícito de recursos según implementación actual.

Evaluación:

- El startup crea snapshot, event bus in-memory y métricas locales.
- El middleware puede reconstruir snapshot o bus si faltan en `app.state`.
- Esto reduce fragilidad si el startup no pobló estado, pero no elimina errores de import.

### Dependencias DB/Redis

Estado actual:

- No importa DB.
- No importa Redis.
- No abre conexiones a DB ni cache.
- No comparte estado con event bus externo.

Conclusión:

- No bloquea por dependencia DB/Redis propia.
- Su riesgo principal es de importación y consistencia por worker, no de infraestructura remota.

### Providers externos y activación de IA clínica

Hallazgo:

- No hay llamadas directas a `httpx`, `requests`, `aiohttp`, sockets ni clientes remotos en este archivo.
- Los módulos leídos de MetaBrain usados por este archivo operan sobre flags, validación de entorno, fallback y event bus in-memory.
- `runtime_guard.py` explícitamente marca `external_calls_allowed` y `phi_allowed` desde flags, pero no ejecuta llamadas.

Conclusión:

- No activa IA clínica real.
- No dispara llamadas externas.
- No toca PHI clínica fuera de metadata de request y flags.

### Event bus y multi-worker

Hallazgo confirmado en MetaBrain/observability_py/event_bus.py:

- `InMemoryObservabilityEventBus` usa `deque` local con `threading.RLock`.
- Es thread-safe dentro del proceso.
- No coordina estado entre procesos.
- Cada worker tendrá su propio buffer y sus propias métricas.

Impacto:

- Semántica de observabilidad local por worker.
- No sirve como fuente global consolidada.
- Un rollback o diagnóstico debe asumir fragmentación entre workers.

### PHI/PII handling

Mecanismos detectados:

- `_safe_headers()` redacciona headers sensibles por nombre: authorization, cookie, token, secret, key.
- Solo preserva `x-trace-id`, `x-correlation-id`, `x-tenant-id` y `user-agent` con truncamiento.
- `build_structured_log()` usa `sanitize_telemetry_payload()`.
- `sanitize_telemetry_payload()` redacciona secretos, emails, teléfonos, tokens y resume estructuras complejas.

Observación clave:

- El campo `headers` que se pasa al payload termina siendo resumido a `[SUMMARY_ONLY]`, así que no se persisten los headers detallados.

Conclusión:

- El tratamiento de PII/PHI es conservador y razonable para shadow telemetry.

### Logs y side effects

Side effects:

- `initialize_runtime_integration_state()` hace `logger.info(...)` en startup.
- `passive_runtime_integration_middleware()` publica eventos al bus in-memory solo si `observability["enabled"]` está activo.
- Actualiza contadores locales en `app.state.runtime_integration_metrics`.

Riesgos:

- Los contadores de métricas son dicts mutables sin lock explícito.
- En un worker async típico esto suele ser aceptable para telemetría best-effort, pero no para contabilidad fuerte.
- No hay persistencia externa, por lo que se pierde estado al reiniciar worker.

### Import-time effects

Estado actual:

- A nivel import no hay conexiones, no hay pings, no hay llamadas remotas.
- Solo se resuelven imports y constantes.

Riesgo real:

- Si el path `MetaBrain.*` no está disponible en el runtime del proceso, main.py fallará al importar.
- Este riesgo es de empaquetado/despliegue, no de lógica interna del archivo.

### Compatibilidad con pre-canary

Evaluación:

- Compatible con pre-canary si el objetivo es observabilidad pasiva y validación de safety flags.
- No altera request/response bodies.
- No introduce enforcement.
- No depende de Redis ni DB.
- El comportamiento por worker debe estar documentado como limitación.

### Veredicto runtime_integration.py

**Clasificación:** CAUTION

Razones:

- Es pasivo y no bloqueante por diseño.
- No hace llamadas externas ni toca DB/Redis.
- Maneja PII/PHI de forma conservadora.
- Pero depende de imports `MetaBrain.*` presentes en runtime.
- Su observabilidad es local por worker y no global.
- Carece de tests de integración para asegurar que no altera orden o semántica de middleware.

### Qué ajustar antes o junto al commit

- Documentar explícitamente que el event bus es per-worker y no global.
- Verificar empaquetado/ruta de imports `MetaBrain.*` en el runtime final.
- Asegurar tests de no interferencia con otros middlewares.

### Tests necesarios

- Request normal sin flags de observabilidad.
- Request con `OBSERVABILITY_ENABLED=true`.
- Excepción en endpoint y publicación de evento con severity `error`.
- Multi-worker con confirmación de buffers independientes.
- Confirmar que no cambia body, status ni headers funcionales del response.

### Commit recomendado

- Debe ir en commit Runtime/MetaBrain dedicado.
- No debe mezclarse con el commit de rate limiting/security.

---

## 6. Riesgos críticos

- `api/app/main.py` depende por import directo de dos archivos untracked.
- `rate_limit.py` puede tumbar startup si Redis no responde a `ping()`.
- `rate_limit.py` puede causar 500 en requests si Redis cae luego del startup.
- La estrategia actual de identidad basada en `X-Forwarded-For` no es segura sin trusted proxy.
- `main.py` no debe commitearse con estas dependencias separadas o no auditadas.

---

## 7. Riesgos medios

- `runtime_integration.py` depende de imports `MetaBrain.*` correctos en el runtime.
- El event bus de runtime integration es in-memory y por worker.
- Las métricas de runtime integration son best-effort y no transaccionales.
- La expiración del rate limiter puede quedar inconsistente si falla entre `INCR` y `EXPIRE`.

---

## 8. Tests y validaciones ejecutadas

Validaciones de lectura/estática realizadas:

- `git status --short`
- `git status --short -- api/app/services/rate_limit.py api/app/runtime_integration.py api/app/main.py`
- `git diff -- main.py`
- `git diff -- api/app/main.py`
- lectura completa de:
  - api/app/services/rate_limit.py
  - api/app/runtime_integration.py
  - MetaBrain/observability_py/event_bus.py
  - MetaBrain/production_safety_py/runtime_guard.py
  - MetaBrain/production_safety_py/startup_validator.py
  - MetaBrain/production_safety_py/safe_fallback.py
  - MetaBrain/observability_py/structured_logger.py
  - MetaBrain/observability_py/telemetry_flags.py
  - MetaBrain/observability_py/trace_context.py
  - MetaBrain/observability_py/telemetry_sanitizer.py
- validación sintáctica:

```text
e:/GSentinelHealthOS/.venv_runtime_lab/Scripts/python.exe -m py_compile api/app/services/rate_limit.py api/app/runtime_integration.py
```

Resultado:

- `py_compile` sin salida: sintaxis válida en ambos archivos.
- No se ejecutó servidor.
- No se levantó Docker.
- No se llamaron servicios externos.

---

## 9. Clasificación GO / CAUTION / NO-GO

### api/app/services/rate_limit.py

- **Clasificación:** NO-GO
- **Motivo:** seguridad y disponibilidad incompletas para un commit seguro.

### api/app/runtime_integration.py

- **Clasificación:** CAUTION
- **Motivo:** diseño pasivo aceptable, pero requiere commit aislado y tests de no interferencia.

### Dependencias en main.py

- **Clasificación:** NO-GO como bloque conjunto actual.
- **Motivo:** mezcla un archivo NO-GO con uno CAUTION y ambos son import-time dependencies de un main.py aún unstaged.

---

## 10. Orden seguro de commits

Orden recomendado:

1. Corregir o endurecer `api/app/services/rate_limit.py`.
2. Hacer commit Security dedicado con:
   - `api/app/services/rate_limit.py`
   - porción security correspondiente de `api/app/main.py`
3. Validar comportamiento con Redis disponible y no disponible.
4. Hacer commit Runtime/MetaBrain dedicado con:
   - `api/app/runtime_integration.py`
   - porción runtime correspondiente de `api/app/main.py`
5. Validar middleware pasivo y semántica per-worker.

No recomendado:

- Commits mezclados Security + Runtime/MetaBrain en un solo bloque.
- Commitear `main.py` antes que sus dependencias untracked.

---

## 11. Qué NO debe mezclarse

- `rate_limit.py` no debe mezclarse con runtime integration.
- Falla de Redis y observabilidad MetaBrain no deben compartir el mismo commit.
- Seguridad de middleware HTTP no debe mezclarse con telemetría pasiva de MetaBrain.
- No mezclar correcciones de disponibilidad Redis con cambios de startup observability si se quiere rollback simple.

---

## 12. Rollback recomendado

Si el commit Security falla:

- revertir solo el commit de `rate_limit.py` y el slice de main.py que lo usa.
- no tocar `runtime_integration.py` si ya está validado por separado.

Si el commit Runtime/MetaBrain falla:

- revertir solo `runtime_integration.py` y su registro en main.py.
- mantener fuera del rollback el bloque de security si ya quedó estable.

Regla operativa:

- rollback por dominio, nunca por mezcla.
- preservar los untracked hasta que cada uno tenga su commit aislado.

---

## Conclusión ejecutiva

- `api/app/services/rate_limit.py` no está listo para commit seguro en su estado actual.
- `api/app/runtime_integration.py` está cerca de ser commiteable, pero solo en commit Runtime/MetaBrain aislado.
- `api/app/main.py` no debe staged ni commitearse junto con ambos cambios mientras persista el estado actual mezclado.
