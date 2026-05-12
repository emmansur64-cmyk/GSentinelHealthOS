# RATE_LIMIT_HARDENING_REPORT

**Fecha:** 2026-05-12  
**Repositorio:** E:/GSentinelHealthOS

## 1. Problema original

El archivo [api/app/services/rate_limit.py](api/app/services/rate_limit.py) estaba en estado NO-GO porque:

- dependía de Redis como requisito duro;
- hacía `ping()` en startup y podía bloquear el arranque;
- si Redis caía durante requests, podía propagar excepción y convertir el middleware en 500;
- la identidad del cliente se resolvía en [api/app/main.py](api/app/main.py) confiando en `X-Forwarded-For` sin validación de proxy confiable;
- el archivo seguía untracked mientras [api/app/main.py](api/app/main.py) ya lo importaba.

## 2. Causa del NO-GO

La causa raíz era una combinación de tres fallas de diseño:

- ausencia de degradación controlada cuando Redis no está disponible;
- trust boundary incorrecto para `X-Forwarded-For`;
- ausencia de tests focales que demostraran comportamiento seguro en startup y request-time.

## 3. Cambios aplicados

Se endureció [api/app/services/rate_limit.py](api/app/services/rate_limit.py) con estos cambios:

- Redis opcional en startup.
- `build_redis_rate_limiter()` ya no rompe startup si `ping()` falla.
- fallback in-memory bounded con cleanup por TTL y tope de claves.
- degradación controlada en request-time si Redis falla después del startup.
- logging sanitizado con tipo de error, sin IPs ni secretos.
- hashing de identidad para keys Redis/memoria, evitando persistir IP cruda.
- configuración por entorno:
  - `RATE_LIMIT_ENABLED`
  - `RATE_LIMIT_REDIS_REQUIRED`
  - `RATE_LIMIT_FALLBACK_IN_MEMORY`
  - `RATE_LIMIT_FALLBACK_MAX_KEYS`
  - `TRUSTED_PROXY_ENABLED`
  - `TRUSTED_PROXY_CIDRS`
  - `TRUSTED_PROXY_IPS`
- helper `resolve_rate_limit_identity()` para resolver `X-Forwarded-For` solo si el `remote_addr` pertenece a un proxy confiable configurado.

Además se hizo el ajuste mínimo en [api/app/main.py](api/app/main.py) para:

- usar `resolve_rate_limit_identity()`;
- exponer `X-RateLimit-Backend`;
- exponer `X-RateLimit-Degraded=true` cuando el sistema entra en degradación controlada;
- evitar 500 por degradación del rate limiter.

Se agregó validación focal en [tests/unit/test_rate_limit_hardening.py](tests/unit/test_rate_limit_hardening.py).

## 4. Redis fallback

Comportamiento final:

- Si Redis está disponible: backend `redis`.
- Si Redis no está disponible en startup y fallback está habilitado: backend `memory-fallback`.
- Si Redis cae durante requests y fallback está habilitado: backend `memory-fallback`.
- Si Redis cae y fallback está deshabilitado: backend `degraded-open`, permitiendo la request sin 500 y marcando degradación por headers/log.

Esto cumple la restricción de no ocultar errores críticos: el problema se registra por log, pero no se tumba la API.

## 5. Proxy trust

Comportamiento final:

- `X-Forwarded-For` se ignora por defecto.
- Solo se acepta si `TRUSTED_PROXY_ENABLED=true` y `request.client.host` coincide con `TRUSTED_PROXY_IPS` o cae dentro de `TRUSTED_PROXY_CIDRS`.
- Si no hay proxy confiable, se usa `request.client.host`.

Esto elimina el bypass trivial por spoofing de `X-Forwarded-For` en despliegues sin reverse proxy confiable.

## 6. Tests ejecutados

Validaciones ejecutadas:

- `e:/GSentinelHealthOS/.venv_runtime_lab/Scripts/python.exe -m py_compile api/app/services/rate_limit.py`
- `e:/GSentinelHealthOS/.venv_runtime_lab/Scripts/python.exe -m py_compile api/app/services/rate_limit.py tests/unit/test_rate_limit_hardening.py api/app/main.py`
- `e:/GSentinelHealthOS/.venv_runtime_lab/Scripts/python.exe -m pytest tests/unit/test_rate_limit_hardening.py -q`

Resultado:

- 6 tests focales pasaron.

Cobertura focal validada:

- Redis unavailable at startup no rompe build.
- Redis falla durante request no devuelve 500.
- fallback in-memory limita correctamente.
- `X-Forwarded-For` se ignora sin trusted proxy.
- `X-Forwarded-For` se acepta solo con trusted proxy.
- cleanup del fallback queda acotado.

Observación sobre diff:

- `git diff -- api/app/services/rate_limit.py` no mostró contenido porque [api/app/services/rate_limit.py](api/app/services/rate_limit.py) sigue untracked; eso es consistente con el estado actual previo a stage.

## 7. Riesgos restantes

Riesgos que siguen presentes, pero ya no son NO-GO para el archivo aislado:

- Redis sigue usando `INCR` seguido de `EXPIRE`; no es una operación atómica única.
- El fallback in-memory es local por proceso; con múltiples workers, su estado no es global.
- El algoritmo sigue siendo fixed-window y no sliding-window.
- [api/app/main.py](api/app/main.py) sigue mezclando este slice de security con runtime_integration en el diff amplio total.

## 8. Rollback

Rollback recomendado si este endurecimiento causara regresión:

1. revertir el slice de security en [api/app/main.py](api/app/main.py);
2. revertir [api/app/services/rate_limit.py](api/app/services/rate_limit.py);
3. revertir [tests/unit/test_rate_limit_hardening.py](tests/unit/test_rate_limit_hardening.py) si se decide descartar el endurecimiento completo.

No mezclar rollback de rate limit con [api/app/runtime_integration.py](api/app/runtime_integration.py).

## 9. Estado GO/CAUTION/NO-GO final

Clasificación final:

- [api/app/services/rate_limit.py](api/app/services/rate_limit.py): **GO** para commit Security aislado.
- Slice correspondiente en [api/app/main.py](api/app/main.py): **CAUTION** hasta separarlo del bloque Runtime/MetaBrain.
- Bloque completo actual de [api/app/main.py](api/app/main.py): sigue **NO-GO** mientras permanezca mezclado con `runtime_integration.py`.

## 10. Próximo paso seguro

El siguiente paso seguro no es commitear todo `main.py`.

El siguiente paso seguro es:

1. aislar el slice Security de [api/app/main.py](api/app/main.py) que usa el rate limiter endurecido;
2. mantener [api/app/runtime_integration.py](api/app/runtime_integration.py) fuera de ese commit;
3. preparar un commit Security dedicado con:
   - [api/app/services/rate_limit.py](api/app/services/rate_limit.py)
   - el slice Security de [api/app/main.py](api/app/main.py)
   - [tests/unit/test_rate_limit_hardening.py](tests/unit/test_rate_limit_hardening.py)
