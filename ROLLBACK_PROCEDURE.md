# ROLLBACK PROCEDURE
**Generado:** 2026-05-12 22:06 ART  
**Válido para revertir:** deploy hardened `gsentinelhealthos/api:hardened-20260512-2137`  
**Estado:** LISTO PARA EJECUCIÓN INMEDIATA — NO ejecutar salvo emergencia

---

## DISPARADORES DE ROLLBACK

Ejecutar rollback SOLO si se verifica alguno de estos:

| Condición | Evidencia |
|-----------|-----------|
| API en crash loop | `docker logs gs_api` muestra Traceback repetido |
| Endpoint legítimo retorna 403/401 inesperado | Usuarios válidos no pueden autenticarse |
| Workers de booking dejan de procesar | Cola Redis crece sin procesarse |
| DB no alcanzable desde API | Logs muestran `OperationalError` o `connection refused` |
| Regresión funcional confirmada | Feature crítico roto (no relacionado a auth) |

**NO hacer rollback por:**
- Solicitudes anónimas rechazadas (403) → eso es CORRECTO, es el hardening
- Performance levemente distinta → monitorear primero
- Dudas de integración → testear antes de rollbackear

---

## IMÁGENES DISPONIBLES PARA ROLLBACK

| Propósito | Tag | Image ID | Estado |
|-----------|-----|----------|--------|
| **Rollback API** | `gsentinelhealthos/api:rollback-20260512-2137` | `d9868f3e26ba` | ✅ Disponible local |
| **Rollback Frontend** | `gsentinelhealthos/web:rollback-pre-session` | `283589541a44` | ✅ Disponible local |

Verificar antes de ejecutar:
```bash
docker images | grep rollback
```

---

## PROCEDIMIENTO DE ROLLBACK — API (ÚNICO COMPONENTE A REVERTIR)

### TIEMPO ESTIMADO: ~60 segundos

### PASO 1 — Verificar disponibilidad de imagen rollback

```bash
docker inspect gsentinelhealthos/api:rollback-20260512-2137 \
  --format '{{.Id}}'
# Debe devolver: sha256:d9868f3e26bac5665211287a713e9b8d64ee14001211c74c471e1d56b30a49e7
```

Si no está disponible, DETENER y usar backup físico:
```bash
# No hay backup físico (.tar) generado en esta sesión.
# Alternativa: reconstruir desde git con git checkout <hash-previo>
git stash
docker compose -f docker-compose.yml build api
```

### PASO 2 — Re-tagear imagen de rollback como latest

```bash
docker tag \
  gsentinelhealthos/api:rollback-20260512-2137 \
  gsentinelhealthos-api:latest
```

Verificar:
```bash
docker inspect gsentinelhealthos-api:latest --format '{{.Id}}'
# Debe ser: sha256:d9868f3e26ba...
```

### PASO 3 — Recrear solo el container API

```bash
docker compose \
  -f e:/GSentinelHealthOS/docker-compose.yml \
  up -d --no-build --force-recreate api
```

⚠️ ADVERTENCIA: Este comando también recreará `db`, `redis-master`, `redis-replica`, `redis-sentinel-1` por las dependencias declaradas en compose. Los VOLÚMENES son persistentes — los datos NO se pierden.

### PASO 4 — Verificar rollback exitoso

```bash
# 1. Imagen correcta corriendo
docker inspect gs_api --format '{{.Image}}'
# Debe ser: sha256:d9868f3e26ba...

# 2. API viva
curl -s http://127.0.0.1:8000/api/health/liveness
# Debe responder: {"status":"alive",...}

# 3. Confirmar imagen PRE-hardening (las vulnerabilidades vuelven a estar activas)
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/v1/patients/
# Retornará 500 (schema bug) o 200 (PHI expuesto) — NO 403
# Si retorna 403 = rollback FALLIDO, la imagen hardened sigue activa
```

### PASO 5 — Comunicar estado

Después del rollback:
1. Notificar al equipo que las vulnerabilidades V1/V2/V3 están ACTIVAS nuevamente
2. NO exponer el sistema a internet hasta resolver el problema que causó el rollback
3. Abrir incidente para investigar la causa raíz

---

## ROLLBACK FRONTEND (SOLO SI ES NECESARIO)

El frontend actual (`283589541a44`) fue construido durante la sesión de hardening. Si necesita revertirse al estado anterior a la sesión completa:

```bash
# Imagen pre-sesión del frontend (c1eef26b3087)
# NO está tagueada para rollback fácil — reconstruir desde git

git stash
docker compose -f docker-compose.yml build frontend
docker compose -f docker-compose.yml up -d --no-build --force-recreate frontend
```

---

## COMANDOS DE VERIFICACIÓN RÁPIDA

```bash
# Estado general del stack
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

# Imagen corriendo en API
docker inspect gs_api --format 'ImageID={{.Image}}'

# Logs recientes API
docker logs gs_api --since 5m 2>&1 | grep -E "ERROR|Traceback|startup complete|200|403"

# Health liveness
curl -s http://127.0.0.1:8000/api/health/liveness

# Test negativo rápido (debe ser 403 en hardened, puede ser 500/200 en rollback)
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/v1/patients/
```

---

## REFERENCIAS

| Documento | Contenido |
|-----------|-----------|
| `backups/pre-hardened-deploy-20260512-2137/ROLLBACK_MANIFEST.md` | Manifiesto completo de backup |
| `backups/pre-hardened-deploy-20260512-2137/image_hashes.txt` | SHA-256 de todas las imágenes |
| `backups/pre-hardened-deploy-20260512-2137/containers_inspect.json` | Configuración exacta pre-deploy |
| `HARDENED_BUILD_REPORT.md` | Imágenes hardened y sus digests |
| `POST_DEPLOY_VALIDATION.md` | Evidencia de deploy exitoso |

---

## FASE 6: COMPLETADA ✅
**ROLLBACK NO EJECUTADO — Solo preparado y documentado**
