# BLOQUE A — CORE INFRA HARDENING RESULT

Fecha: 2026-05-16

## 1) Estado inicial

- Compose principal válido (`docker compose config` OK).
- Runtime con PostgreSQL, Redis master/replica/sentinel y servicios core en estado `Up`.
- Workers `booking_worker_0`, `booking_worker_1`, `outbox_scheduler` sin healthcheck efectivo en runtime.
- `migrate-api` observado en `Exited (255)`; `migrate-frontend` en `Exited (0)`.
- Persistencia activa en volúmenes de PostgreSQL y Redis.

## 2) Hallazgos (clasificados)

1. **Alto** — Exposición potencial de secretos al usar `docker compose config` con salida completa.  
   Evidencia: comando resuelve variables de entorno en claro.

2. **Medio** — Workers críticos sin healthcheck operativo en runtime (`["NONE"]`).  
   Evidencia: `docker inspect ... .Config.Healthcheck.Test`.

3. **Medio** — Drift de estado de migración API (`migrate-api Exited 255`).  
   Evidencia: `docker compose ps --all`.

4. **Medio** — Compose alternativos de lab/preprod usan Redis sin persistencia (`--appendonly no`).  
   Evidencia: `docker-compose.runtime-lab.yml`, `docker-compose.brain-preproduction.yml`.

5. **Bajo** — Red principal `gs_prod` no es `internal`; mitigado por publicación en loopback de puertos de app y no publicación de DB/Redis.

6. **Bajo** — Advertencias por variables de `panel-admin` no definidas (perfil opcional).

7. **Bajo** — Riesgo residual de healthcheck superficial en workers (solo conectividad TCP, no lógica funcional de cola).

## 3) Cambios realizados (seguros, acotados, reversibles)

### 3.1 Backup previo de archivo editado
- Archivo: `docker-compose.yml`
- Backup creado: `docker-compose.yml.bak.BLOQUE_A_20260516_1242`

### 3.2 Hardening aplicado
- Archivo editado: `docker-compose.yml`
- Cambio: se reemplazó `healthcheck: disable: true` por healthchecks no destructivos en:
  - `booking_worker_0`
  - `booking_worker_1`
  - `outbox_scheduler`
- Test agregado: conectividad TCP a `db:5432` y `redis-master:6379`.
- Impacto runtime inmediato: ninguno (no restart / no recreate).

## 4) Cambios NO realizados

- No se recrearon contenedores para aplicar healthchecks nuevos en runtime.
- No se cambió imagen/version de PostgreSQL.
- No se cambió imagen/version de Redis.
- No se cambiaron puertos/redes/credenciales.
- No se tocaron volúmenes.
- No se ejecutaron migraciones.
- No se hizo deploy.

## 5) Riesgos pendientes

1. Healthchecks nuevos no activos hasta recreación autorizada de workers. (**Medio**)
2. `migrate-api Exited (255)` requiere análisis puntual y decisión operativa. (**Medio**)
3. Falta prueba formal periódica de restore en entorno aislado con evidencia archivada. (**Alto**)
4. Riesgo operativo si se reutilizan compose de laboratorio como referencia de persistencia. (**Medio**)

## 6) Validaciones ejecutadas (no destructivas)

1. `docker compose config --services`  
   Resultado: OK, lista de servicios emitida.

2. `docker compose config` (a archivo temporal, no reporte)  
   Resultado: OK (`compose_config_ok`), sin exponer salida sensible en este documento.

3. `docker ps`  
   Resultado: servicios core `Up`; DB/Redis/sentinels healthy.

4. `docker inspect` health/restart de contenedores core  
   Resultado:
   - DB/Redis/Sentinel: healthchecks presentes.
   - Workers runtime actuales: `["NONE"]` (esperable hasta recreación).
   - Restart policy: `unless-stopped` en core observado.

5. Verificación de puertos (`docker ps`)  
   Resultado: puertos de app en `127.0.0.1`; DB/Redis no publicados al host.

6. Verificación de redes (`docker network inspect gsentinelhealthos_gs_prod`)  
   Resultado: red bridge operativa, 17 contenedores conectados.

7. Verificación de volúmenes (`docker volume inspect ...`)  
   Resultado: volúmenes persistentes para DB/Redis/uploads presentes.

8. Lectura segura de logs
   - `gs_db`: recuperación automática WAL observada tras arranque interrumpido.
   - `gs_redis_master`: snapshots RDB periódicos exitosos.
   - `gs_booking_worker_0`: errores históricos de resolución DNS/BusyLoading al arranque, luego estado de escucha.

9. `git diff -- docker-compose.yml`  
   Resultado: diff confirma cambios de healthcheck en 3 workers.

10. Verificación de secretos en archivos modificados/nuevos  
   Resultado: sin secretos hardcodeados nuevos en reportes creados.

## 7) Rollback

Para revertir cambios de esta intervención:

1. Restaurar archivo:
   - `Copy-Item -LiteralPath docker-compose.yml.bak.BLOQUE_A_20260516_1242 -Destination docker-compose.yml -Force`
2. Verificar consistencia:
   - `docker compose config`
3. No aplicar runtime hasta autorización explícita.

## 8) Próximo bloque recomendado

Recomendado: iniciar bloque de **Runtime Reliability / Orchestration Controls** enfocado en:
- política de aplicación controlada de cambios en workers (ventana autorizada),
- verificación de one-shot migrations,
- drill de restore en lab con evidencia periódica.

## 9) Confirmaciones explícitas de restricción

- no deploy: **confirmado**
- no restart: **confirmado**
- no migraciones: **confirmado**
- no borrado de volúmenes: **confirmado**
- no exposición de secretos: **confirmado en reportes**
- no activación IA clínica: **confirmado**
- no cambios en MB-Chat: **confirmado**
- no cambios en MB-Secretaria: **confirmado**
- no cambios en MB-Whatsapp: **confirmado**
