# POST-DEPLOY VALIDATION REPORT
**Timestamp:** 2026-05-12 22:04 ART  
**Deploy ejecutado:** `gsentinelhealthos/api:hardened-20260512-2137`  
**Image ID:** `sha256:de6cb70abf815a2d...`  
**Container:** `gs_api` — Started: 2026-05-13T01:03:03Z

---

## RESULTADO GLOBAL: **21/21 PASS — 0 FAIL** ✅

---

## 1. CONFIRMACIÓN DE IMAGEN DEPLOYADA

```
docker inspect gs_api --format '{{.Image}}'
→ sha256:de6cb70abf815a2d2cc2e01f03e93dc9adcd3a0c5e034e2c29bf96a26e00eefe
```
✅ Imagen hardened confirmada. La imagen pre-hardening (`d9868f3e26ba`) ya no corre.

---

## 2. HEALTHCHECKS

| Endpoint | Respuesta | Estado |
|----------|-----------|--------|
| GET /api/health/liveness | 200 | ✅ VIVO |
| GET / | 200 | ✅ ACCESIBLE |
| DB (gs_db) | healthy | ✅ |
| Redis (gs_redis_master) | healthy | ✅ |
| Sin crash loops (últimos 60s) | 0 crashes | ✅ |

---

## 3. VALIDACIÓN DE SEGURIDAD POST-DEPLOY (PRODUCCIÓN)

### Patients — endpoint PHI crítico
| Test | HTTP | Estado |
|------|------|--------|
| GET /api/v1/patients/ [anon] | 403 | ✅ BLOQUEADO |
| GET /api/v1/patients/{id} [anon] | 403 | ✅ BLOQUEADO |
| POST /api/v1/patients/ [anon] | 403 | ✅ BLOQUEADO |
| PUT /api/v1/patients/{id} [anon] | 403 | ✅ BLOQUEADO |
| DELETE /api/v1/patients/{id} [anon] | 403 | ✅ BLOQUEADO |

### Doctors
| Test | HTTP | Estado |
|------|------|--------|
| GET /api/v1/doctors/ [anon] | 403 | ✅ BLOQUEADO |
| POST /api/v1/doctors/ [anon] | 403 | ✅ BLOQUEADO |
| DELETE /api/v1/doctors/{id} [anon] | 403 | ✅ BLOQUEADO |

### Slots (appointment booking/cancellation)
| Test | HTTP | Estado |
|------|------|--------|
| POST /api/v1/slots/book [anon] | 403 | ✅ BLOQUEADO |
| POST /api/v1/slots/appointments/1/cancel [anon] | 403 | ✅ BLOQUEADO |
| POST /api/v1/slots/appointments/2/cancel [anon] | 403 | ✅ BLOQUEADO |
| POST /api/v1/slots/generate [anon] | 403 | ✅ BLOQUEADO |

### Meta OAuth2
| Test | HTTP | Estado |
|------|------|--------|
| POST /api/meta/embedded-signup/callback [anon] | 401 | ✅ BLOQUEADO |
| GET /api/meta/embedded-signup/callback?state=UUID-raw | 401 | ✅ BLOQUEADO |
| POST /api/meta/embedded-signup/initiate [anon] | 401 | ✅ BLOQUEADO |

---

## 4. LOGS POST-DEPLOY (extracto)

```
INFO  uvicorn - Application startup complete
INFO  172.20.0.1 - POST /api/meta/embedded-signup/callback → 401 Unauthorized
INFO  172.20.0.1 - GET  /api/meta/embedded-signup/callback?code=x&state=UUID → 401
INFO  172.20.0.1 - POST /api/meta/embedded-signup/initiate → 401 Unauthorized
INFO  127.0.0.1  - GET  /api/health/liveness → 200 OK
```

Sin tracebacks. Sin crashes. Sin errores críticos.

---

## 5. CONTAINERS ACTIVOS POST-DEPLOY

| Container | Imagen | Status | Imagen ID |
|-----------|--------|--------|-----------|
| gs_api | gsentinelhealthos-api | Up ~2min (starting→healthy) | `de6cb70abf81` ✅ HARDENED |
| gs_frontend | gsentinelhealthos-frontend | Up 17min (healthy) | `283589541a44` ✅ |
| gs_db | postgres:16-alpine | Up ~2min (healthy) | intacto |
| gs_redis_master | redis:8.0.2-alpine | Up ~2min (healthy) | intacto |
| gs_brain | gsentinelhealthos-brain | Up 12h (healthy) | sin cambios |
| gs_gateway | gsentinelhealthos-gateway | Up 12h (healthy) | sin cambios |
| gs_*_workers | (sin cambios) | Up 12h | sin cambios |

---

## 6. NOTA — chat.service.ts (PHI residual)

Durante el deploy se detectó que `chat.service.ts` fue modificado externamente conservando `phone: true` en el SELECT de Prisma. Este campo es recuperado de la DB pero **no es transmitido al LLM Groq** (bloqueado en `formatContext()` en `groq-doctor-chat.ts`). El riesgo es que el número de teléfono viaja en el objeto `sharedContext` interno en memoria del servidor Node.js pero no llega a la red externa (Groq API). Pendiente: remover `phone` del SELECT en una próxima PR.

---

## CONCLUSIÓN

**El deploy hardened está completamente operativo en producción.**

Las tres vulnerabilidades críticas (V1/V2/V3) ya no son explotables en el sistema productivo:
- `GET /api/v1/patients/` sin auth → antes **200** | ahora **403** ✅
- `DELETE /api/v1/doctors/{id}` sin auth → antes **200** | ahora **403** ✅  
- `POST /api/v1/slots/appointments/1/cancel` sin auth → antes **200** | ahora **403** ✅

**FASE 5: COMPLETADA ✅**
