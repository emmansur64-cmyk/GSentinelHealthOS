# AUTH HEALTH/REALTIME COMPAT FIX REPORT

## 1. Causa del NO-GO (commit 282626d)
- `/api/health/readiness` quedó protegido con `Depends(validate_api_key)` sin actualizar consumidores.
  - `docker/api.Dockerfile` HEALTHCHECK usaba `/readiness` sin auth → 403 → contenedor unhealthy.
  - `scripts/vps_healthcheck.sh` y `deploy/gcp/deploy.sh`, `deploy/gcp/check.sh` llamaban `/readiness` sin auth → 403.
- `WS /ws/notifications` exigía cookie `gs_access_token` pero frontend Next.js (`medical-agenda-saas`) opera con cookie `auth_token`.
  - Riesgo de desconexión total de notificaciones realtime para usuarios autenticados.

## 2. Contrato health final

| Endpoint | Auth requerida | Estado esperado | Datos expuestos |
|---|---|---|---|
| `/api/health/liveness` | ninguna (público) | 200 siempre | `{"status":"alive"}` |
| `/api/health/readiness` | ninguna (público mínimo) | 200 (ready) / 503 (not_ready) | checks DB + Redis, sin detalles internos |
| `/api/health/dashboard-summary` | `X-Internal-Key` | 403 sin key | métricas internas completas |
| `/api/health/outbox` | `X-Internal-Key` | 403 sin key | estado outbox |
| `/api/health/providers` | `X-Internal-Key` | 403 sin key | circuit breakers |
| `/api/health/booking-workers` | `X-Internal-Key` | 403 sin key | workers + heartbeat |

### readiness payload público (200)
```json
{
  "status": "ready",
  "timestamp": "...",
  "service": "GSentinelHealthOS API",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```
Sin exposición de: outbox, providers, brain_metrics, queue_depths, booking_workers.

## 3. Contrato realtime final

`WS /ws/notifications` acepta:
- Cookie `gs_access_token` (nombre canónico backend)
- Cookie `auth_token` (nombre legacy frontend Next.js — compatibilidad)

Prioridad: `gs_access_token` tiene precedencia si ambas están presentes.

Sin credencial: cierre `WS_1008_POLICY_VIOLATION`, reason `"Missing authentication"`.  
Con JWT inválido: cierre `WS_1008_POLICY_VIOLATION`, reason `"Invalid or missing JWT token"`.  
Conexiones anónimas: rechazadas sin excepción.  
Tokens: nunca logueados.

## 4. Archivos modificados
- `api/app/api/v1/endpoints/health.py` — readiness rediseñado como endpoint público mínimo
- `api/app/api/v1/endpoints/realtime.py` — WS acepta `auth_token` además de `gs_access_token`
- `tests/integration/test_health_contract.py` — nuevo (12 tests focales)
- `tests/integration/test_realtime_notifications_ws.py` — actualizado (6 tests + 2 nuevos de auth/compat)

## 5. Tests ejecutados
```
tests/integration/test_health_contract.py              12 passed
tests/integration/test_realtime_notifications_ws.py     6 passed
Total: 18 passed, 0 failed
```

### Cobertura focal:
- `test_liveness_public_returns_200` ✅
- `test_readiness_public_never_403` ✅
- `test_readiness_returns_200_when_ok` ✅
- `test_readiness_returns_503_when_redis_down` ✅
- `test_internal_endpoint_rejects_anon` × 4 endpoints ✅
- `test_internal_endpoint_rejects_wrong_key` × 4 endpoints ✅
- `test_notifications_websocket_rejects_without_cookie` ✅
- `test_notifications_websocket_rejects_invalid_jwt` ✅
- `test_notifications_websocket_accepts_gs_access_token` ✅
- `test_notifications_websocket_accepts_auth_token_cookie` ✅
- `test_notifications_websocket_broadcasts_json_events` ✅
- `test_notifications_websocket_supports_whatsapp_events` ✅

## 6. Validación de consumidores

| Consumidor | Endpoint usado | Estado anterior | Estado actual |
|---|---|---|---|
| `docker-compose.yml` API | `/api/health/liveness` | ✅ OK | ✅ OK (sin cambio) |
| `docker-compose.precanary-lab.yml` | `/api/health/liveness` | ✅ OK | ✅ OK (sin cambio) |
| `docker/api.Dockerfile` HEALTHCHECK | `/api/health/readiness` | ❌ 403 | ✅ 200/503 compatible |
| `scripts/vps_healthcheck.sh` | `/api/health/readiness` | ❌ 403 | ✅ 200/503 compatible |
| `deploy/gcp/deploy.sh` | `/api/health/readiness` | ❌ 403 | ✅ 200/503 compatible |
| `deploy/gcp/check.sh` | `/api/health/readiness` | ❌ 403 | ✅ 200/503 compatible |
| Frontend `useNotifications.js` | `WS /ws/notifications` | ❌ sin auth_token compat | ✅ auth_token aceptado |
| Frontend `doctor-dashboard.tsx` | `WS /ws/notifications` | ❌ sin auth_token compat | ✅ auth_token aceptado |

Los scripts y Dockerfiles no requirieron modificación porque readiness volvió a ser público.

## 7. Riesgos restantes
- **Bajo (migración de cookie):** La compatibilidad `auth_token` es un puente temporal. El frontend debería emitir eventualmente `gs_access_token` para unificar nombres. Esto es un plan de deuda técnica, no un riesgo de ruptura inmediata.
- **Bajo (readiness público sin detalles):** El endpoint ahora solo reporta `database` y `redis`. Si algún consumidor dependía del payload detallado de readiness (outbox/providers), necesitará migrar a `/dashboard-summary` con `X-Internal-Key`.
- **Ninguno:** endpoints clínicos, MetaBrain, imaging, migrations, secrets — sin tocar.

## 8. Rollback
```bash
git revert 9081351 --no-edit
```
Esto revierte el fix de compatibilidad y restaura el estado NO-GO de `282626d`.  
No afecta ningún otro endpoint ni datos persistentes.  
No requiere migraciones.

## 9. Estado final
**GO ✅**

Evidencia:
- `py_compile` OK sobre los 4 archivos.
- 18/18 tests focales pasando.
- Stage selectivo limpio (solo archivos del dominio health/realtime).
- Commit `9081351` en branch `GsentinelH`.
- Consumidores críticos de readiness validados como compatibles.
- Contrato WS validado para `gs_access_token` y `auth_token`.
- Sin tocar: MetaBrain clinical, medical imaging, migrations, secrets, providers externos, pacientes/doctores, producción.
