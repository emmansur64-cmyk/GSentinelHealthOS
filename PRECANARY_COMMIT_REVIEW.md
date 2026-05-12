# PRECANARY COMMIT REVIEW

Fecha: 2026-05-12
Objetivo: commit selectivo seguro del bloque pre-canary Linux/Docker sin mezclar worktree previo.

## Regla de seguridad aplicada

- No se uso git add .
- No se uso git add -A.
- No se uso git commit -a.
- Stage solo por rutas explicitas.

## Inventario worktree

Estado observado:
- Worktree preexistente muy sucio (gran cantidad de archivos modificados/no trackeados fuera de scope pre-canary).
- Riesgo de mezcla: ALTO si se usa stage global.

Archivos pre-canary detectados para revision:
1. api/app/db/session.py
2. api/app/main.py
3. .env.runtime_lab_docker
4. docker-compose.precanary-lab.yml
5. RUNTIME_DOCKER_LINUX_PRECANARY_REPORT.md
6. RUNTIME_PRECANARY_ROLLBACK_PLAN.md

Archivos excluidos:
- Todo archivo fuera de la lista anterior.

## Revision de diff limitado

### 1) api/app/db/session.py
Decision: GO

Validacion:
- Retry bounded presente (5 intentos).
- Backoff+jitter presentes.
- Timeout explicito por intento (`asyncio.timeout`).
- Error visible al agotar retries (no swallow silencioso).
- Sin credenciales hardcoded.
- Cierre limpio de engine implementado (`close_async_database_runtime`).

### 2) api/app/main.py
Decision: NO-GO para stage completo de archivo

Motivo:
- El diff incluye bloques amplios adicionales (middlewares/seguridad/rate-limit/runtime integration) que exceden el alcance estricto del commit pre-canary.
- Stagear el archivo completo mezclaria cambios ajenos.

Accion:
- Excluir este archivo del stage selectivo en este commit.
- Mantenerlo sin stage para evitar mezcla.

### 3) .env.runtime_lab_docker
Decision: GO

Validacion:
- Valores de laboratorio/sinteticos.
- Sin hosts productivos.
- Sin tokens reales.
- Sin PHI.

### 4) docker-compose.precanary-lab.yml
Decision: GO

Validacion:
- Red/servicios aislados (`*_precanary_lab`).
- Puertos loopback locales (`127.0.0.1`).
- Workers explicitos (`--workers 2`).
- Healthcheck estricto de liveness (status 200).
- Sin providers externos.

### 5) RUNTIME_DOCKER_LINUX_PRECANARY_REPORT.md
Decision: GO

Validacion:
- Evidencia real de pruebas.
- Sin secretos reales.
- Sin PHI.
- Sin URLs productivas sensibles.

### 6) RUNTIME_PRECANARY_ROLLBACK_PLAN.md
Decision: GO

Validacion:
- Triggers claros.
- Pasos de rollback seguros.
- Verificaciones post-rollback definidas.

## Validaciones pre-stage ejecutadas

1. `git diff --check -- <archivos permitidos>`
- Resultado: OK (sin errores de check en diff permitido).

2. `docker compose -f docker-compose.precanary-lab.yml up -d --wait`
- Resultado: OK (postgres, redis y api saludables).

3. Health local:
- `GET /api/health/liveness`: 200
- `GET /api/health/readiness` con header interno: 200
- `status=ready`, `redis_connected=true`

## Warnings

- Worktree global continua con alto volumen de cambios ajenos.
- `api/app/main.py` queda fuera del commit para evitar mezcla de alcance.

## Validacion de secretos

- Se intento escaneo con herramienta de secret scanning sobre contenido staged.
- Resultado del tool: repositorio sin GitHub Advanced Security habilitado.
- Mitigacion aplicada: revision manual por patrones (`api_key`, `token`, `secret`, `password`, URLs) en archivos permitidos.
- Conclusion: no se detectaron credenciales reales ni endpoints productivos en los archivos staged.

## Decision final

GO para commit selectivo de archivos pre-canary puros.
NO-GO para incluir `api/app/main.py` completo en este commit.
