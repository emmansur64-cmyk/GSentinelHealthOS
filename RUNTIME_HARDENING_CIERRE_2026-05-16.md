# RUNTIME HARDENING — CIERRE TÉCNICO

Fecha: 2026-05-16  
Entorno: `E:\GSentinelHealthOS` (preproducción real)  
Política respetada: sin deploy, sin restart, sin migraciones destructivas, sin borrado de datos/volúmenes.

## 1. Estado observado (evidencia real)

- `docker ps`: servicios core activos y `healthy` (API, Brain, Gateway, Frontend, PostgreSQL, Redis master/replica/sentinels).
- `docker stats --no-stream`: consumo estable, sin presión de memoria crítica.
- Health endpoints:
  - `http://127.0.0.1:8000/api/health/liveness` => `200`
  - `http://127.0.0.1:8000/api/health/readiness` => `200`
  - `http://127.0.0.1:8001/health` => `200`
- Logs (`api/gateway/brain`, últimos 30m): sin `ERROR/CRITICAL/Traceback` detectados.

## 2. Hallazgos críticos reales

### H1 — Guard defectuoso en endpoint interno de appointments
- Evidencia: `validate_slot_gateway` referenciaba `request` no declarado.
- Riesgo: fallo de autorización en runtime interno.

### H2 — Endpoint interno sin tenant obligatorio
- Evidencia: `validate_slot_gateway` permitía ejecución sin `clinic_id` explícito.
- Riesgo: aumento de superficie de acceso cruzado.

### H3 — Redis Sentinel degradado para failover
- Evidencia:
  - Redis master/replica OK (`role:master`, `connected_slaves:1`, replica `master_link_status:up`).
  - Sentinel reportando `s_down,disconnected` sobre `mymaster`.
  - `broker/sentinel.conf` no incluía `sentinel auth-pass mymaster ...` pese a `requirepass` en master.
- Riesgo: failover no confiable (HA incompleta).

### H4 — Panel admin con validación JWT potencialmente fail-open cuando secreto vacío
- Evidencia: middleware usaba `process.env.SUPER_ADMIN_JWT_SECRET ?? ''` sin fail-closed.
- Riesgo: validación inconsistente bajo configuración inválida.

## 3. Cambios aplicados (seguros, reversibles, no destructivos)

## 3.1 API appointments hardening
- Archivo: [api/app/api/v1/endpoints/appointments.py](/e:/GSentinelHealthOS/api/app/api/v1/endpoints/appointments.py)
- Cambios:
  1. Se agregó `request: Request` en `validate_slot_gateway`.
  2. Se exige `tenant.clinic_id` (`403`) cuando falta `X-Clinic-Id`.
- Backup:
  - [api/app/api/v1/endpoints/appointments.py.bak.BLOQUE_B_20260516_130931](/e:/GSentinelHealthOS/api/app/api/v1/endpoints/appointments.py.bak.BLOQUE_B_20260516_130931)

## 3.2 Panel admin auth hardening (fail-closed)
- Archivo: [Panel-SuperAdmin/src/middleware.ts](/e:/GSentinelHealthOS/Panel-SuperAdmin/src/middleware.ts)
- Cambio:
  - Si `SUPER_ADMIN_JWT_SECRET` está vacío, redirige a login y limpia cookie (`sa_token`), sin intentar verificar JWT con secreto vacío.
- Backup:
  - [Panel-SuperAdmin/src/middleware.ts.bak.RUNTIME_HARDEN_20260516_140647](/e:/GSentinelHealthOS/Panel-SuperAdmin/src/middleware.ts.bak.RUNTIME_HARDEN_20260516_140647)

## 3.3 Redis Sentinel hardening en Compose (preparado, no aplicado en runtime por política sin restart)
- Archivo: [docker-compose.yml](/e:/GSentinelHealthOS/docker-compose.yml)
- Cambio:
  - En `redis-sentinel-1/2/3` se inyecta `sentinel auth-pass mymaster` dinámicamente en `/tmp/sentinel.conf` usando `REDIS_PASSWORD` de entorno (sin hardcodear secreto en repositorio).
- Backup:
  - [docker-compose.yml.bak.RUNTIME_HARDEN_20260516_140813](/e:/GSentinelHealthOS/docker-compose.yml.bak.RUNTIME_HARDEN_20260516_140813)

## 4. Validaciones ejecutadas post-cambio

- `docker compose config --quiet`: válido (persisten warnings de variables panel no definidas).
- `git diff`: cambios acotados en los archivos indicados.
- Runtime sin reinicio:
  - servicios continúan `Up` y `healthy`.
  - checks HTTP de salud continúan `200`.

## 5. Rollback explícito

1. Restaurar archivos desde backups:
   - `appointments.py.bak.BLOQUE_B_20260516_130931`
   - `middleware.ts.bak.RUNTIME_HARDEN_20260516_140647`
   - `docker-compose.yml.bak.RUNTIME_HARDEN_20260516_140813`
2. Verificar con `git diff` que no queden cambios.
3. No requiere migraciones para rollback.

## 6. Estado de robustez y cierre

## Lo que sí quedó firme
- Endurecimiento auth interno de appointments (guard + tenant boundary).
- Fail-closed para middleware de Panel Admin con secreto ausente.
- Corrección de configuración Sentinel preparada de forma segura y reversible.

## Lo que falta para 10/10 real
- Aplicar cambio de Sentinel en runtime (requiere recrear sentinels, hoy no ejecutado por política sin restart).
- Resolver variables sensibles faltantes en panel (`SUPER_ADMIN_*`, `PANEL_ADMIN_API_KEY`) con gestión segura.
- Completar plan de rotación/segregación de secretos fuera de compose efectivo.
- Ejecutar smoke tests post-recreate de Sentinel para confirmar failover real operativo.

## Veredicto honesto
- **No es 10/10 todavía** sin activar en runtime el hardening de Sentinel y cerrar secretos de panel.
- **Sí quedó claramente más robusto, más cerrado y más seguro** con cambios reales, acotados y reversibles, sin dañar lógica ni producción.

