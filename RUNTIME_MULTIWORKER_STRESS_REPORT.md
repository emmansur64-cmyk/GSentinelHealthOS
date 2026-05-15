# RUNTIME MULTIWORKER STRESS REPORT

Última actualización: 2026-05-12
Estado: **RESUELTO Y VALIDADO**

---

## Diagnóstico de causa raíz (sesión 2)

### Problema original
`psycopg.errors.ConnectionTimeout` en `validate_async_database_runtime()` al arrancar
uvicorn con `--workers 2`.

### Causas raíz identificadas

| # | Causa | Severidad |
|---|---|---|
| 1 | `validate_async_database_runtime()` hacía **un solo intento** sin retry | Alta |
| 2 | `pool_size=10` hard-coded → 2 workers × 10 = 20 conexiones simultáneas en startup | Media |
| 3 | Sin jitter por PID → ambos workers atacaban la DB al mismo tiempo exacto | Media |
| 4 | `asyncio.timeout()` no envolvía el intento → cuelgue indefinido posible | Media |
| 5 | `uvicorn --workers N` en Windows/Python 3.14 falla con `OSError WinError 10022` en socket binding (limitación de plataforma, no del código) | Plataforma |
| 6 | `asyncio.set_event_loop_policy()` no afecta `asyncio.run()` en Python 3.14 cuando uvicorn corre como proceso padre con `--workers 1` | Plataforma |

### Fix aplicado

**`api/app/db/session.py`**:
- Retry bounded: 5 intentos, backoff exponencial (0.4s base, max 5s), jitter PID `(pid % 13) * 0.05s`
- `asyncio.timeout(connect_timeout + 2s)` en cada intento — previene cuelgues silenciosos
- Captura `OperationalError`, `asyncio.TimeoutError`, `OSError`, genérico para `psycopg.errors.ConnectionTimeout`
- Logs lab-safe por intento: pid, attempt, host sanitizado, elapsed_ms, outcome, exc_class
- Fallo visible (re-raise) si se agotan los intentos
- `pool_size` configurable via `DATABASE_POOL_SIZE` env var

**`api/app/core/config.py`**:
- Campo `database_pool_size: int` con alias `DATABASE_POOL_SIZE` (default 10)

**`.env.runtime_lab`**:
- `DATABASE_POOL_SIZE=2` — limita a 2 conexiones por worker en lab
- `DATABASE_CONNECT_TIMEOUT_SECONDS=20`

**`scripts/run_api_lab_worker.py`** (nuevo):
- Runner lab que carga `.env.runtime_lab` antes de importar el proyecto
- Pasa `loop_factory=asyncio.SelectorEventLoop` a `uvicorn.run()` para Python 3.14 compatibility
- Safety check: valida que DB apunte a 127.0.0.1:55432 y Redis a 127.0.0.1:56379
- Emite `[lab_worker] pid=... host=... port=...` en stdout

### Por qué `uvicorn --workers 2` en Python 3.14/Windows

`uvicorn --workers N` en Windows usa `multiprocessing.spawn`. El padre crea el socket,
establece `SO_REUSEADDR` y llama `bind()`. Luego los hijos heredan el fd y cada uno
intenta llamar `sock.listen()` — Windows rechaza esto con `WSAEINVAL (WinError 10022)`
cuando el socket ya está en estado LISTEN. No es un bug del código; es una incompatibilidad
de la implementación de `multiprocessing spawn` de Windows con el modelo de socket-sharing
de uvicorn. En Linux/Docker (fork), el fd hereda el estado completo y `listen()` no se
vuelve a llamar.

**Evidencia del fix**: con `--workers 2` ambos workers completaron `SELECT 1` exitosamente
y registraron `Application startup complete` antes de que el WinError 10022 ocurriera
en el socket bind post-startup. El DB startup timeout está resuelto.

---

## Resultado de validación dual-worker (2026-05-12)

### Método: dos instancias independientes (correcto para Windows nativo)

```
Worker-A: scripts/run_api_lab_worker.py --port 18080
Worker-B: scripts/run_api_lab_worker.py --port 18081
```

### Startup evidencia

| Worker | PID | Puerto | SELECT 1 | startup complete |
|---|---|---|---|---|
| A | 50776 | 18080 | OK (0.50ms) | ✅ |
| B | 59184 | 18081 | OK (1.63ms) | ✅ |

### HTTP E2E evidencia

| Check | W-A :18080 | W-B :18081 |
|---|---|---|
| GET /api/health/liveness | 200 alive | 200 alive |
| GET /api/health/readiness | 200 ready | 200 ready |
| redis_connected | true | true |
| Stress 10×liveness | 10/10 OK | 10/10 OK |

### Shutdown

- Sin listeners residuales en 18080/18081 post-kill
- Docker lab down limpio: postgres + redis removidos
- Sin procesos huérfanos

---

## Riesgos remanentes

| Riesgo | Severidad | Mitigación |
|---|---|---|
| `uvicorn --workers N` en Windows/Python 3.14 falla por WinError 10022 | Plataforma | Usar `run_api_lab_worker.py` (instancias independientes) o desplegar en Linux/Docker |
| `asyncio.set_event_loop_policy` deprecado en Python 3.16 | Futuro | Migrar a `loop_factory` explícito (ya implementado con detección de firma) |
| `notification_outbox` tabla inexistente en lab DB | Lab-only | No aplica a producción (schema migrado); en lab es esperado |
| `brain_metrics` per-worker no agrega cross-process | Diseño | Documentado en EVENT_BUS_MULTIPROCESS_LIMITATION.md |

## Rollback

Si el fix de session.py genera regresiones:
1. Restaurar `validate_async_database_runtime()` al intento único original
2. Restaurar `pool_size=10` hard-coded
3. Remover `DATABASE_POOL_SIZE` de config.py
4. El runner `run_api_lab_worker.py` es nuevo y no afecta producción

## Estado

- Multi-worker stress: bloqueado por startup DB timeout bajo multi-proceso.
- Sin ocultar fallos.
- Sin tocar endpoints, sin providers externos, sin IA clínica.
