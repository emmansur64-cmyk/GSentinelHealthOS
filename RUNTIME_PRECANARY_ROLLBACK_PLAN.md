# RUNTIME PRECANARY ROLLBACK PLAN

Fecha: 2026-05-12
Ambito: entorno pre-canary Docker/Linux aislado.
Objetivo: rollback rapido y seguro ante degradacion en runtime multi-worker.

## Principios

- No tocar produccion real durante rollback de laboratorio.
- Mantener visibilidad de errores (no ocultar fallas).
- Priorizar restaurar disponibilidad de health endpoints.

## Triggers de rollback

Ejecutar rollback si se observa cualquiera:
1. Falla recurrente de startup en workers (DB timeout no recuperable).
2. Readiness inestable (>20% fallas sostenidas por 5 min).
3. Errores 5xx sostenidos en liveness/readiness.
4. Degradacion severa de latencia (p95 > 2s sostenido en checks de salud).
5. Workers colgados o reinicios en bucle.

## Rollback rapido (nivel 1)

Objetivo: volver a baseline estable del entorno pre-canary.

1. Detener stack pre-canary:
- `docker compose -f docker-compose.precanary-lab.yml down`

2. Verificar puertos libres:
- `Get-NetTCPConnection -LocalPort 18090,55433,56380 -State Listen -ErrorAction SilentlyContinue`

3. Levantar stack nuevamente limpio:
- `docker compose -f docker-compose.precanary-lab.yml up -d --build --wait`

4. Verificar health:
- `GET /api/health/liveness` -> 200
- `GET /api/health/readiness` con `X-Internal-Key` -> 200

## Rollback de configuracion runtime (nivel 2)

Si nivel 1 no estabiliza:

1. Reducir concurrencia de API temporalmente a 1 worker en compose pre-canary:
- cambiar comando a `--workers 1` SOLO en `docker-compose.precanary-lab.yml`

2. Mantener DB pool conservador:
- `DATABASE_POOL_SIZE=2` (o bajar a 1 temporalmente)

3. Relanzar stack:
- `docker compose -f docker-compose.precanary-lab.yml up -d --build --wait`

4. Revalidar endpoints y logs de startup.

## Rollback de codigo (nivel 3)

Aplicar solo si se confirma regresion por cambios de esta fase:

1. Revertir shutdown DB dispose:
- quitar llamada `close_async_database_runtime()` en shutdown de main.

2. Revertir estrategia de retry startup DB (ultimo recurso):
- restaurar implementacion anterior en session.

3. Rebuild y revalidar en entorno aislado.

Nota: no ejecutar commits automaticos ni `git add .`.

## Validaciones post-rollback

Checklist:
1. Startup completo en API (workers levantan sin timeout DB).
2. Liveness 200 estable.
3. Readiness 200 con key interna.
4. Redis conectado (`redis_connected=true`).
5. Shutdown limpio sin listeners residuales.

## Comandos de emergencia

- Estado servicios:
  - `docker compose -f docker-compose.precanary-lab.yml ps`
- Logs API:
  - `docker compose -f docker-compose.precanary-lab.yml logs --tail=200 api_precanary_lab`
- Restart API:
  - `docker compose -f docker-compose.precanary-lab.yml restart api_precanary_lab`
- Teardown total:
  - `docker compose -f docker-compose.precanary-lab.yml down`

## Decision gate para seguir a canary

Permitir avance SOLO si:
1. Multi-worker Linux/Docker estable.
2. Startup concurrente DB sin timeout.
3. Readiness/liveness confiables.
4. Shutdown limpio repetible.
5. Sin errores criticos en logs de runtime.
