# AUTH IMPACT HEALTH/REALTIME AUDIT

## 1. Commit auditado
- Commit: `282626d9aad98eae06e59a9a7eb668398ac19f8e`
- Mensaje: `fix(api): align runtime-safe non-clinical endpoints`
- Archivos:
  - `api/app/api/v1/endpoints/health.py`
  - `api/app/api/v1/endpoints/realtime.py`

## 2. Endpoints afectados
En `health.py` (router prefix `/health`, expuesto como `/api/health/*`):
- `/api/health/readiness`
- `/api/health/dashboard-summary`
- `/api/health/outbox`
- `/api/health/providers`
- `/api/health/booking-workers`

Sin cambios de auth en:
- `/api/health/liveness` (permanece público)

En `realtime.py`:
- `WS /ws/notifications`

## 3. Cambios de auth detectados
### Health
Se agregó `Depends(validate_api_key)` a 5 endpoints.
`validate_api_key` exige:
- Header `X-Internal-Key` válido (403 si falta/inválido)
- Validación opcional de IP por `GATEWAY_ALLOWED_IPS` / `BRAIN_ALLOWED_IPS` (403 si no cumple)

Resultado práctico:
- endpoints `readiness/dashboard-summary/outbox/providers/booking-workers` ahora devuelven 403 sin `X-Internal-Key`.
- `liveness` sigue 200 público.

### Realtime
Se cambió websocket para requerir cookie JWT:
- Cookie esperada: `gs_access_token` (`AUTH_COOKIE_NAME`)
- Si no existe: close `1008` reason `Missing authentication`
- Si JWT inválido: close `1008` reason `Invalid or missing JWT token`

## 4. Consumidores encontrados
### Infra / healthcheck
1. `docker-compose.yml` (API service)
   - healthcheck: `http://localhost:8000/api/health/liveness`
   - Tipo: infra interna, no autenticada
   - Compatibilidad: **OK** (liveness sigue público)

2. `docker-compose.precanary-lab.yml`
   - healthcheck: `http://localhost:8000/api/health/liveness`
   - Tipo: infra lab, no autenticada
   - Compatibilidad: **OK**

3. `docker/api.Dockerfile`
   - HEALTHCHECK: `http://localhost:8000/api/health/readiness`
   - Tipo: healthcheck de imagen, no autenticado
   - Compatibilidad: **ROTO** (403 sin header)

4. `scripts/vps_healthcheck.sh`
   - usa `http://localhost:8000/api/health/readiness`
   - Tipo: monitor interno shell, no autenticado
   - Compatibilidad: **ROTO** (403)

5. `deploy/gcp/check.sh` y `deploy/gcp/deploy.sh`
   - usan `/api/health/readiness` sin auth
   - Tipo: deployment checks internos
   - Compatibilidad: **ROTO** (403)

6. `api/app/main.py`
   - root anuncia `"health": "/api/health/readiness"`
   - Tipo: documentación runtime interna
   - Compatibilidad: **DESACTUALIZADO** (requiere auth ahora)

### Frontend / WebSocket
7. `medical-agenda-saas/src/hooks/useNotifications.js`
   - `new WebSocket(.../ws/notifications)` sin token query/header
   - Tipo: browser/frontend
   - Compatibilidad: depende de cookie `gs_access_token` en dominio backend

8. `medical-agenda-saas/src/components/doctor-dashboard.tsx`
   - `new WebSocket(.../ws/notifications)` sin token explícito
   - Tipo: browser/frontend
   - Compatibilidad: depende de cookie `gs_access_token`

9. `medical-agenda-saas` auth local
   - usa cookie `auth_token` (no `gs_access_token`) en `src/app/api/auth/login/route.ts` y `src/lib/server-auth.ts`
   - Tipo: sesión frontend interna
   - Compatibilidad con websocket backend: **ALTO RIESGO DE RUPTURA** por cookie mismatch

### Tests
10. `api/tests/runtime_multiworker_stress.py`, `api/tests/test_runtime_integration.py`, `api/tests/test_runtime_startup_lab.py`, `tests/integration/test_flows.py`
- referencian `/api/health/readiness`
- Tipo: tests internos no autenticados
- Compatibilidad: **probable ruptura** salvo fixture/header explícito

## 5. Compatibilidad por consumidor (resumen)
- Autenticados y compatibles: no se identificó consumidor explícito de readiness con `X-Internal-Key` en healthchecks/script auditados.
- No autenticados compatibles: solo consumidores de `/api/health/liveness`.
- No autenticados incompatibles: todos los consumidores de `/api/health/readiness` sin header.
- Websocket legacy/browser: probable incompatibilidad cuando solo existe `auth_token` (frontend) y no `gs_access_token` (backend).

## 6. Pruebas ejecutadas (locales seguras)
1. Diff del commit:
- `git show --stat 282626d9aad98eae06e59a9a7eb668398ac19f8e`
- `git show ... -- health.py`
- `git show ... -- realtime.py`

2. Compilación sintáctica:
- `python -m py_compile api/app/api/v1/endpoints/health.py api/app/api/v1/endpoints/realtime.py`
- Resultado: OK

3. Curl local sin auth (localhost:8000):
- `/api/health/liveness` => **200**
- `/api/health/readiness` => **403**
- `/api/health/dashboard-summary` => **403**

4. Búsqueda de consumidores internos/externos en compose, Dockerfiles, scripts, frontend, tests.

No se ejecutó deploy, migraciones, providers externos, ni endpoints clínicos.

## 7. Riesgos
- **Crítico (infra):** readiness quedó protegido sin mecanismo explícito para healthcheck de imagen (`docker/api.Dockerfile`) y scripts de operación.
- **Crítico (frontend realtime):** WebSocket exige `gs_access_token`, pero frontend opera con `auth_token`; riesgo de desconexión de notificaciones en clientes legacy.
- **Medio (tests/CI):** tests que esperan readiness público pueden fallar por 403.
- **Bajo:** liveness permanece público y funcional para compose actual.

## 8. Estado GO/CAUTION/NO-GO
**Estado final: NO-GO**

Motivos:
1. Hay consumidores críticos de readiness sin auth que hoy reciben 403.
2. Existe riesgo alto de incompatibilidad websocket por cookie mismatch (`auth_token` vs `gs_access_token`).
3. No se observó fallback operativo documentado para checks internos en los consumidores auditados.

## 9. Fix recomendado (no aplicado)
Fix mínimo propuesto:
1. Mantener `/api/health/liveness` público (ya está).
2. Para readiness:
   - Opción A (recomendada): endpoint separado de infraestructura (`/api/health/readiness-public`) con payload mínimo no sensible y sin dependencias críticas.
   - Opción B: mantener `/api/health/readiness` protegido, pero actualizar todos los consumidores internos (`docker/api.Dockerfile`, scripts gcp/vps, tests) para enviar `X-Internal-Key` + estrategia IP allowlist.
3. WebSocket:
   - Alinear autenticación de frontend y backend:
     - emitir `gs_access_token` en flujo de login frontend hacia dominio backend, o
     - aceptar temporalmente `auth_token` en websocket gateway con validación equivalente (fallback controlado y temporal).
4. Documentar contrato de healthchecks para Docker/K8s y clientes internos.

## 10. Próximo paso seguro
1. Decidir estrategia de compatibilidad (A/B) para readiness.
2. Ejecutar PR pequeño de compatibilidad (sin tocar clínico):
   - o endpoint público mínimo,
   - o actualización de consumers para `X-Internal-Key`.
3. Añadir prueba de regresión:
   - liveness público 200,
   - readiness protegido 403 sin header y 200 con header válido,
   - websocket: 1008 sin cookie y conexión OK con cookie válida.
4. Re-auditar antes de push/canary.
