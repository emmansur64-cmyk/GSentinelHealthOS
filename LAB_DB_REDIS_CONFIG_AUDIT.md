# LAB DB/REDIS CONFIG AUDIT

Fecha: 2026-05-12
Scope: runtime integrado en lab aislado, sin conexiones a producción.

## Fuente real de configuración

1. API settings centralizados en `api/app/core/config.py`:
- `DATABASE_URL` (obligatorio, validado)
- `REDIS_URL` (default local)
- secretos obligatorios en startup de settings: `JWT_SECRET`, `GATEWAY_API_KEY`, `BRAIN_API_KEY`
- `Settings` carga por defecto `.env`.

2. DB runtime en `api/app/db/session.py`:
- Usa `settings.database_url` para crear `AsyncEngine`.
- En startup se ejecuta `SELECT 1` via `validate_async_database_runtime()`.
- Si DB no responde, startup falla.

3. Redis runtime en `api/app/main.py` + `api/app/services/rate_limit.py`:
- Startup crea dos rate limiters con `build_redis_rate_limiter(settings.redis_url, ...)`.
- `build_redis_rate_limiter` hace `redis.ping()` obligatorio.
- Si Redis no responde, startup falla.

4. Endpoints de health en `api/app/api/v1/endpoints/health.py`:
- Usan DB y Redis para observabilidad/readiness.
- Capturan errores de Redis en algunas rutas, pero startup ya exige Redis OK.

5. `shared/config.py`:
- Carga `.env` de forma opcional para módulos compartidos.
- `dashboard.py` usa `shared.config.REDIS_URL`, por lo que el proceso debe arrancar con env lab ya exportado.

## Riesgos de apuntar a producción

- Riesgo alto si se usa `.env` existente sin aislar variables de proceso.
- `docker-compose.yml` principal usa red `gs_prod`, servicios y defaults orientados al stack principal.
- Usar `docker compose up` del archivo principal puede iniciar servicios no deseados y tocar datos reales según `.env` activo.
- `DATABASE_URL`/`REDIS_URL` heredados del shell podrían conectar fuera del entorno lab.

## Servicios requeridos para startup/lifespan real

- PostgreSQL accesible por `DATABASE_URL` lab.
- Redis accesible por `REDIS_URL` lab.
- Variables sintéticas obligatorias para settings:
- `JWT_SECRET`
- `GATEWAY_API_KEY`
- `BRAIN_API_KEY`

## Comandos seguros sugeridos (todavía sin conectar)

1. Definir env lab explícito por archivo dedicado (`.env.runtime_lab`).
2. Levantar solo compose lab dedicado (`docker-compose.runtime-lab.yml`).
3. Ejecutar API/tests cargando explícitamente `.env.runtime_lab` al proceso.
4. Verificar destino antes de conectar:
- DB host debe ser `127.0.0.1` puerto `55432`
- Redis host debe ser `127.0.0.1` puerto `56379`

## Bloqueos detectados

- Startup real depende de DB y Redis disponibles; no hay modo "degraded startup" para rate limiter.
- `Settings` apunta a `.env` por defecto; si no se inyecta env lab en el proceso, hay riesgo de herencia de configuración no lab.
- Se requiere confirmar disponibilidad de Docker para opción A aislada.

## Decisión de seguridad para continuar

- Continuar solo con env lab explícito y puertos no estándar.
- No usar `docker-compose.yml` principal.
- Si cualquier verificación muestra host/puerto distinto de `127.0.0.1:55432` y `127.0.0.1:56379`, detener inmediatamente.
