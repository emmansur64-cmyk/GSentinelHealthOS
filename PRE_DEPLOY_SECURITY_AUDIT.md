# PRE-DEPLOY SECURITY AUDIT
**Timestamp:** 2026-05-12 21:37 ART  
**Branch:** GsentinelH  
**Auditor:** Claude Security Architect  
**Estado:** AUDITORÍA COMPLETA — PRE-DEPLOY LISTO CONDICIONALMENTE

---

## 1. GIT STATUS

### Archivos modificados (unstaged hardening):
| Archivo | Cambio |
|---------|--------|
| `api/app/core/security.py` | `Optional[Request]` → `Request` en validate_hybrid_auth |
| `api/app/dependencies/tenant.py` | Nueva función `get_tenant_context` (JWT obligatorio) |
| `api/app/api/v1/endpoints/patients.py` | Auth obligatoria: `validate_hybrid_auth` + `validate_api_key` |
| `api/app/api/v1/endpoints/doctors.py` | Auth obligatoria: `validate_hybrid_auth` en 6 endpoints |
| `api/app/api/v1/endpoints/time_slots_simple.py` | Auth + fix prefijo `/api/v1/slots` |
| `api/app/api/v1/endpoints/buffer_slots.py` | Auth + fix prefijo + ahora registrado en main |
| `api/app/api/v1/endpoints/meta.py` | OAuth2 CSRF: state HMAC firmado + auth en callbacks |
| `api/app/api/v1/endpoints/realtime.py` | JWT por cookie (gs_access_token + auth_token legacy) |
| `api/app/services/patient_service.py` | Tenant hard fail (clinic_id=None → HTTP 403) + PHI log clean |
| `api/app/services/doctor_service.py` | PHI log clean |
| `api/app/main.py` | Registrar buffer_slots.router |
| `medical-agenda-saas/src/lib/groq-doctor-chat.ts` | Eliminar phone del contexto LLM |
| `medical-agenda-saas/src/chat/chat.service.ts` | Eliminar phone del SELECT Prisma |
| `medical-agenda-saas/src/app/api/super-admin/clinics/[id]/whatsapp/route.ts` | Cifrar app_secret |
| `docker-compose.yml` | (cambios previos no relacionados al hardening) |

### Commits HEAD (no deployados en container):
```
9081351 fix(api): restore health and realtime compatibility
282626d fix(api): align runtime-safe non-clinical endpoints
3d58875 chore(docker-config): runtime-safe compose and dockerfile alignment
984a1b3 chore(dockerignore): exclude MetaBrain generated artifacts
...
```

---

## 2. CONTAINERS ACTIVOS

| Container | Imagen | Status | Puertos |
|-----------|--------|--------|---------|
| gs_api | gsentinelhealthos-api (OLD) | Up 11h (healthy) | 127.0.0.1:8000→8000 |
| gs_frontend | gsentinelhealthos-frontend | Up 11h (healthy) | 127.0.0.1:3000→3000 |
| gs_brain | gsentinelhealthos-brain | Up 11h (healthy) | 127.0.0.1:8001→8001 |
| gs_gateway | gsentinelhealthos-gateway | Up 11h (healthy) | 127.0.0.1:8002→8002 |
| gs_nlg_service | gsentinelhealthos-nlg-service | Up 11h (healthy) | 127.0.0.1:8013→8013 |
| gs_inference_service | gsentinelhealthos-inference-service | Up 11h (healthy) | 127.0.0.1:8011→8011 |
| gs_decision_service | gsentinelhealthos/decision-service | Up 11h (healthy) | 127.0.0.1:8012→8012 |
| gs_dialogue_engine | gsentinelhealthos/dialogue-engine | Up 11h (healthy) | 127.0.0.1:8010→8010 |
| gs_db | postgres:16-alpine | Up 11h (healthy) | 5432 (solo interno) |
| gs_redis_master | redis:8.0.2-alpine | Up 11h (healthy) | 6379 (solo interno) |
| gs_redis_replica | redis:8.0.2-alpine | Up 11h (healthy) | 6379 (solo interno) |
| gs_redis_sentinel_[1-3] | redis:8.0.2-alpine | Up 11h (healthy) | 6379 (solo interno) |
| gs_outbox_scheduler | (imagen anon) | Up 11h | — |
| gs_booking_worker_[0-1] | (imágenes anon) | Up 11h | — |

### ⚠️ RIESGO IDENTIFICADO:
**gs_api ejecuta imagen ANTIGUA sin hardening.** Las vulnerabilidades V1/V2/V3 están ACTIVAS en el container corriendo.

---

## 3. PUERTOS EXPUESTOS

| Puerto | Binding | Container | Exposición |
|--------|---------|-----------|------------|
| 3000 | 127.0.0.1:3000 | gs_frontend | SOLO LOCALHOST ✓ |
| 8000 | 127.0.0.1:8000 | gs_api | SOLO LOCALHOST ✓ |
| 8001 | 127.0.0.1:8001 | gs_brain | SOLO LOCALHOST ✓ |
| 8002 | 127.0.0.1:8002 | gs_gateway | SOLO LOCALHOST ✓ |
| 8010 | 127.0.0.1:8010 | gs_dialogue_engine | SOLO LOCALHOST ✓ |
| 8011 | 127.0.0.1:8011 | gs_inference_service | SOLO LOCALHOST ✓ |
| 8012 | 127.0.0.1:8012 | gs_decision_service | SOLO LOCALHOST ✓ |
| 8013 | 127.0.0.1:8013 | gs_nlg_service | SOLO LOCALHOST ✓ |
| 5432 | (sin binding externo) | gs_db | INTERNO ✓ |
| 6379 | (sin binding externo) | gs_redis_* | INTERNO ✓ |

**Conclusión:** Todos los servicios están bindeados a loopback. Ningún puerto expuesto a 0.0.0.0 o red externa.

---

## 4. VOLÚMENES CRÍTICOS

| Volumen | Uso | Estado |
|---------|-----|--------|
| `gsentinelhealthos_postgres_data` | Datos PostgreSQL principales | PERSISTENTE — NO TOCAR |
| `gsentinelhealthos_redis_master_data` | Redis master data | PERSISTENTE — NO TOCAR |
| `gsentinelhealthos_redis_replica_data` | Redis replica | PERSISTENTE — NO TOCAR |
| `gsentinelhealthos_uploads_data` | Archivos subidos | Montado en gs_api :rw |
| `database_gsentinel_postgres_data` | (DB alternativa) | PERSISTENTE |

**Bind mounts observados:**
- `/run/desktop/mnt/host/e/GSentinelHealthOS/database/init-multiple-dbs.sql` → gs_db (read-only ✓)
- `/run/desktop/mnt/host/e/GSentinelHealthOS/broker/redis.conf` → gs_redis_master (read-only ✓)
- `gsentinelhealthos_uploads_data:/data/uploads` → gs_api (read-write)

---

## 5. HEALTHCHECKS

| Container | Comando | Intervalo | Timeout | Retries |
|-----------|---------|-----------|---------|---------|
| gs_api | `GET /api/health/liveness` | 30s | 5s | 3 |
| gs_frontend | `fetch('http://localhost:3000/')` | 30s | 10s | 3 |
| gs_db | `pg_isready -U sentinel -d gsentinel` | 30s | 5s | 3 |
| gs_redis_master | — | — | — | — |

---

## 6. IMAGEN ACTUAL EN PRODUCCIÓN

| Campo | Valor |
|-------|-------|
| Imagen corriendo | `gsentinelhealthos-api:latest` |
| Image ID | `d9868f3e26ba` |
| Creada | 2026-05-08 22:54:56 -03:00 |
| Tamaño | 1.18 GB |
| Código | **PRE-HARDENING** (sin auth en patients/doctors/slots) |

| Campo | Valor |
|-------|-------|
| Imagen hardened (test) | `gs_api_test:latest` |
| Image ID | `af885e5cb076` |
| Creada | 2026-05-12 21:01:57 -03:00 |
| Código | **POST-HARDENING** (validado 34/34 PASS) |

---

## 7. VARIABLES DE ENTORNO CRÍTICAS

Todas las variables críticas están presentes en el container (verificado por inspect):

| Variable | Estado |
|----------|--------|
| `JWT_SECRET` | ✅ Presente |
| `JWT_ISSUER` | ✅ `gsentinel-api` |
| `JWT_AUDIENCE` | ✅ `gsentinel-clients` |
| `DATABASE_URL` | ✅ `postgresql+psycopg://sentinel:***@db:5432/gsentinel` |
| `REDIS_URL` | ✅ `redis://:***@redis-master:6379` |
| `REDIS_SENTINEL_MASTER` | ✅ `mymaster` |
| `SECRET_ENCRYPTION_KEY` | ✅ Presente |
| `GATEWAY_API_KEY` | ✅ Presente |
| `BRAIN_API_KEY` | ✅ Presente |
| `WHATSAPP_VERIFY_TOKEN` | ✅ Presente |
| `ENV` | ✅ `production` |
| `LOG_LEVEL` | ✅ `INFO` |

---

## 8. IMÁGENES DANGLING

Se detectaron **57 imágenes dangling** en el sistema. No afectan el stack pero suman ~40GB de espacio. Limpiar DESPUÉS del deploy exitoso con `docker image prune`.

---

## 9. INTEGRIDAD DE ARCHIVOS HARDENED

| Archivo | SHA-256 (16 chars) |
|---------|-------------------|
| security.py | `3692f3688ea1f45a` |
| tenant.py | `13f489d68c324a68` |
| patients.py | `5e8fca1e95b2c81a` |
| doctors.py | `074f00f258bd2fba` |
| time_slots_simple.py | `0d60f9f66f9b1c21` |
| buffer_slots.py | `641aebb35b68921d` |
| meta.py | `8e990474d4520299` |
| realtime.py | `3c53d78d07c9d221` |
| patient_service.py | `2ae3b0b45e7177f1` |
| doctor_service.py | `027b983929c98d25` |
| main.py | `5e42e98f70a9ba63` |
| groq-doctor-chat.ts | `85138bd3b2e0c20f` |
| chat.service.ts | `e4734be1006efe3b` |
| whatsapp/route.ts | `deac1911c4b4c963` |

---

## 10. EVALUACIÓN FINAL FASE 1

| Dimensión | Estado | Riesgo |
|-----------|--------|--------|
| Puertos expuestos | ✅ Solo loopback | Bajo |
| Volúmenes | ✅ Identificados, intactos | Bajo |
| Healthchecks | ✅ Activos en críticos | Bajo |
| Env vars | ✅ Todas presentes | Bajo |
| Imagen actual gs_api | ⚠️ PRE-HARDENING activa | ALTO |
| Código hardened | ✅ Validado 34/34 PASS | — |
| Sintaxis Python | ✅ 11/11 OK | — |
| PHI logging | ✅ Limpio | — |
| Auth guards | ✅ ALL PASS estructural | — |

**CONCLUSIÓN FASE 1:** Sistema auditado. Imagen hardened disponible y validada. El deploy reemplazará solo `gs_api` y `gs_frontend`. El resto del stack no se toca.

**FASE 1: COMPLETADA ✅**
