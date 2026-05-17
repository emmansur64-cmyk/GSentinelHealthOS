# BLOQUE A — CORE INFRA HARDENING PLAN (FASE 2)

Fecha: 2026-05-16

## Alcance

Este plan cubre PostgreSQL, Redis, Docker/Compose, redes, volúmenes, healthchecks, persistencia, backup/recovery y workers dependientes de Redis/PostgreSQL, sin deploy y sin reinicios no autorizados.

## Qué corregir, por qué, archivo, riesgo, validación y rollback

### 1) Healthchecks ausentes en workers críticos
- Qué corregir: agregar healthchecks no destructivos en `booking_worker_0`, `booking_worker_1`, `outbox_scheduler`.
- Por qué: actualmente sin healthcheck operativo en runtime; si quedan degradados no hay señal de salud del proceso.
- Archivo afectado: `docker-compose.yml`.
- Riesgo: medio.
- Cambio propuesto: healthcheck TCP a `db:5432` y `redis-master:6379`.
- Validación:
  1. `docker compose config`
  2. `docker inspect ... .Config.Healthcheck.Test`
  3. Confirmar que no hubo restart/recreate.
- Rollback: restaurar backup `docker-compose.yml.bak.BLOQUE_A_20260516_1242`.

### 2) Drift de migración API (`migrate-api Exited 255`)
- Qué corregir: documentar causa y criterio de recuperación controlada.
- Por qué: drift entre resultado esperado de migraciones y estado observado.
- Archivo afectado: reporte operativo (sin cambios runtime).
- Riesgo: medio.
- Cambio propuesto: agregar runbook de verificación pre-restart y criterio de one-shot healthy.
- Validación: revisión de logs one-shot y control de estado con `docker compose ps --all`.
- Rollback: N/A (solo documentación).

### 3) Estrategia formal de backup y restore test no consolidada en bloque A
- Qué corregir: consolidar comandos y checklist de backup/recovery para DB+Redis.
- Por qué: existen scripts dispersos; falta consolidación explícita por bloque.
- Archivo afectado: `BLOQUE_A_CORE_INFRA_HARDENING_RESULT.md` y `BLOQUE_A_CORE_INFRA_BASELINE.md`.
- Riesgo: alto (operativo).
- Cambio propuesto:
  - Definir comandos estandarizados (sin ejecución en datos reales durante esta fase).
  - Definir restore test en entorno aislado/lab.
- Validación: revisión estática + comandos listados.
- Rollback: N/A (solo documentación).

### 4) Riesgo de secretos en validaciones de compose
- Qué corregir: política de no registrar salida completa de `docker compose config`.
- Por qué: resuelve variables sensibles si se imprime completo.
- Archivo afectado: reportes Bloque A.
- Riesgo: alto.
- Cambio propuesto: registrar solo estado de ejecución/comandos y salida sanitizada.
- Validación: grep de patrones sensibles en archivos nuevos/modificados.
- Rollback: eliminar artefactos de reporte que contengan secretos (si existieran).

### 5) Diferencias entre compose principal y compose de laboratorio
- Qué corregir: documentar explícitamente que lab/preprod usan Redis efímero sin persistencia.
- Por qué: evita extrapolar garantías de persistencia de producción desde lab.
- Archivo afectado: baseline/result.
- Riesgo: medio.
- Cambio propuesto: matriz de drift por archivo compose.
- Validación: inspección de `docker-compose.runtime-lab.yml` y `docker-compose.brain-preproduction.yml`.
- Rollback: N/A.

## Orden exacto de ejecución

1. Levantar evidencia runtime/compose sin cambios destructivos.  
2. Backup del archivo a editar (`docker-compose.yml`).  
3. Aplicar cambios mínimos reversibles (healthchecks workers).  
4. Ejecutar validaciones no destructivas (`config`, `ps`, inspect red/volumen/health/logs).  
5. Verificar que no se expongan secretos en artefactos.  
6. Documentar hallazgos, cambios, pendientes y rollback.

## Qué NO tocar

- No cambiar imagen/version de PostgreSQL.
- No cambiar imagen/version de Redis.
- No cambiar nombre de volúmenes.
- No cambiar credenciales.
- No cambiar puertos activos.
- No cambiar redes activas.
- No eliminar servicios.
- No recrear contenedores sin autorización explícita.
- No migrar datos.
- No modificar schemas.

## Dependencias con otros bloques

- Bloque B/C (apps y capas superiores) dependen de disponibilidad DB/Redis y de workers saludables.
- Cualquier activación de cambios de healthcheck requiere ventana controlada de recreación (fuera de este alcance).
- Módulos MB-Chat, MB-Secretaria y MB-Whatsapp no se modifican en Bloque A; solo se consideran consumidores de infraestructura.
