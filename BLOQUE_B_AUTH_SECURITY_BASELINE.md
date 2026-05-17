# BLOQUE B — AUTH & SECURITY BASELINE

Fecha de ejecución: 2026-05-16  
Entorno: preproducción real local (`E:\GSentinelHealthOS`)  
Modo aplicado: no deploy, no restart, no migraciones destructivas, no exposición de secretos.

## 1) Sistema de autenticación (evidencia)
- API principal FastAPI con auth híbrida:
  - JWT/cookie + API key interna por servicio en [api/app/core/security.py](/e:/GSentinelHealthOS/api/app/core/security.py).
  - Uso de `validate_hybrid_auth` en endpoints de negocio, por ejemplo [api/app/api/v1/endpoints/appointments.py](/e:/GSentinelHealthOS/api/app/api/v1/endpoints/appointments.py).
- Frontend SaaS con sesión JWT propia y cookie de sesión:
  - [medical-agenda-saas/src/app/api/auth/login/route.ts](/e:/GSentinelHealthOS/medical-agenda-saas/src/app/api/auth/login/route.ts)
  - [medical-agenda-saas/src/lib/auth.ts](/e:/GSentinelHealthOS/medical-agenda-saas/src/lib/auth.ts)

## 2) Middleware auth (evidencia)
- CORS, rate limit, headers de seguridad y CSRF en API:
  - [api/app/main.py](/e:/GSentinelHealthOS/api/app/main.py)
- Contexto tenant desde headers/token:
  - [api/app/dependencies/tenant.py](/e:/GSentinelHealthOS/api/app/dependencies/tenant.py)

## 3) JWT (generación, expiración, validación, signing)
- Signing algorithm configurable (`HS256` por defecto) y validación con `issuer/audience`:
  - [api/app/core/security.py](/e:/GSentinelHealthOS/api/app/core/security.py)
  - [api/app/core/config.py](/e:/GSentinelHealthOS/api/app/core/config.py)
- Cookie auth `gs_access_token` y cookie CSRF `gs_csrf_token`:
  - [api/app/core/security.py](/e:/GSentinelHealthOS/api/app/core/security.py)
  - [api/app/api/v1/endpoints/auth.py](/e:/GSentinelHealthOS/api/app/api/v1/endpoints/auth.py)
- Refresh token:
  - No se encontró flujo formal de refresh token dedicado en API principal (evidencia de login/token y sesión, sin endpoint de refresh explícito en este relevamiento).

## 4) Roles (doctor/paciente/secretaria/admin/superadmin)
- En API principal hay chequeos de rol y ownership:
  - [api/app/dependencies/auth.py](/e:/GSentinelHealthOS/api/app/dependencies/auth.py)
  - [api/app/api/v1/endpoints/appointments.py](/e:/GSentinelHealthOS/api/app/api/v1/endpoints/appointments.py)
- En frontend SaaS existe control por rol en middleware:
  - [medical-agenda-saas/middleware.ts](/e:/GSentinelHealthOS/medical-agenda-saas/middleware.ts)
- No se afirma cobertura total de cada endpoint por cada rol sin matriz completa de tests e2e por rol.

## 5) Multi-tenant (aislamiento, RLS, tenant filters)
- Session variables por request:
  - `app.current_client_id`, `app.current_clinic_id`, `app.tenant_bypass=0` en [api/app/dependencies/db.py](/e:/GSentinelHealthOS/api/app/dependencies/db.py)
- RLS presente y forzado en tablas clínicas clave (runtime SQL):
  - `appointments`, `patients`, `clinic_members`, `client_whatsapp_accounts`, `google_outbox`, `notification_outbox`, `bot_knowledge_base` con `relrowsecurity=t` y `relforcerowsecurity=t`.
- Políticas activas (`pg_policies`) usando `current_setting('app.current_clinic_id')` y bypass controlado.

## 6) PHI protection (sanitizers/redaction/masking)
- Sanitización en MB-Chat/MB-Secretaria/MB-Whatsapp:
  - [MB-Chat/src/common/utils/persistence-sanitizer.util.ts](/e:/GSentinelHealthOS/MB-Chat/src/common/utils/persistence-sanitizer.util.ts)
  - [MB-Secretaria/src/common/utils/persistence-sanitizer.util.ts](/e:/GSentinelHealthOS/MB-Secretaria/src/common/utils/persistence-sanitizer.util.ts)
  - [MB-Whatsapp/src/common/utils/persistence-sanitizer.util.ts](/e:/GSentinelHealthOS/MB-Whatsapp/src/common/utils/persistence-sanitizer.util.ts)
- Sanitización de contexto clínico/IA en SaaS:
  - [medical-agenda-saas/src/lib/doctor-context/sanitizer.ts](/e:/GSentinelHealthOS/medical-agenda-saas/src/lib/doctor-context/sanitizer.ts)
  - [medical-agenda-saas/src/lib/medical-conversation-memory/sanitizer.ts](/e:/GSentinelHealthOS/medical-agenda-saas/src/lib/medical-conversation-memory/sanitizer.ts)

## 7) Secrets (.env, compose, hardcoded)
- Evidencia de secretos en variables de entorno del compose efectivo (`docker compose config`) en texto plano de runtime local.
- Validación de presencia/no-placeholder para secretos críticos de API:
  - [api/app/core/config.py](/e:/GSentinelHealthOS/api/app/core/config.py)
- Riesgo alto por exposición operacional en `docker compose config` y variables embebidas de entorno.

## 8) API Keys (Groq/WhatsApp/Google)
- Uso de API keys y secretos por entorno en compose y servicios.
- Guards API key en MB-*:
  - [MB-Chat/src/ingress/guards/api-key.guard.ts](/e:/GSentinelHealthOS/MB-Chat/src/ingress/guards/api-key.guard.ts)
  - [MB-Secretaria/src/ingress/guards/api-key.guard.ts](/e:/GSentinelHealthOS/MB-Secretaria/src/ingress/guards/api-key.guard.ts)
  - [MB-Whatsapp/src/ingress/guards/api-key.guard.ts](/e:/GSentinelHealthOS/MB-Whatsapp/src/ingress/guards/api-key.guard.ts)

## 9) Logs (PHI/token leakage)
- Runtime `docker logs gs_api --tail 120`:
  - No se observaron tokens completos en el muestreo.
  - Sí se observaron consultas SQL y parámetros no sensibles.
- No se puede afirmar ausencia total de leakage en todos los paths sin muestreo más amplio y pruebas de caos/log fuzzing.

## 10) IA context filtering (qué sale a Groq)
- Pipeline Groq y contexto:
  - [medical-agenda-saas/src/lib/groq-doctor-chat.ts](/e:/GSentinelHealthOS/medical-agenda-saas/src/lib/groq-doctor-chat.ts)
- Hay sanitización y clipping, pero el payload incluye bloques de contexto clínico (paciente/historial/metadata) que requieren gobernanza estricta por minimización.

## 11) MB-Chat auth flow
- Control en ingress/controllers con `ApiKeyGuard` + checks de formato Bearer.
- Evidencia:
  - [MB-Chat/src/ingress/incident.controller.ts](/e:/GSentinelHealthOS/MB-Chat/src/ingress/incident.controller.ts)
  - [MB-Chat/src/ingress/guards/api-key.guard.ts](/e:/GSentinelHealthOS/MB-Chat/src/ingress/guards/api-key.guard.ts)

## 12) MB-Secretaria auth flow
- Igual patrón de guard por API key.
- Control adicional de acceso admin en import preview:
  - [MB-Secretaria/src/import-preview/admin-access.guard.ts](/e:/GSentinelHealthOS/MB-Secretaria/src/import-preview/admin-access.guard.ts)

## 13) MB-Whatsapp auth flow
- Control por `ApiKeyGuard` en controllers sensibles.
- Evidencia:
  - [MB-Whatsapp/src/ingress/incident.controller.ts](/e:/GSentinelHealthOS/MB-Whatsapp/src/ingress/incident.controller.ts)
  - [MB-Whatsapp/src/ingress/guards/api-key.guard.ts](/e:/GSentinelHealthOS/MB-Whatsapp/src/ingress/guards/api-key.guard.ts)

## 14) Rate limiting
- API principal:
  - Middleware de rate-limit + limiter específico de auth.
  - Evidencia runtime: respuestas `429` en ráfaga de `/api/v1/auth/token`.
- MB-*:
  - Rate limit por key implementado in-memory en guard.

## 15) CORS
- Runtime:
  - Preflight con origen no permitido: `400`.
  - Preflight con origen permitido: `200` con `allow-origin` y `allow-credentials`.
- Config:
  - [api/app/main.py](/e:/GSentinelHealthOS/api/app/main.py)

## 16) CSRF
- Middleware activo en API para métodos mutantes cuando hay cookie de auth.
- Runtime:
  - POST con cookie auth simulada y sin CSRF válido devolvió `403 csrf_token_invalid`.

## 17) Session handling
- SaaS maneja sesión con token y validaciones en middleware:
  - [medical-agenda-saas/src/lib/auth.ts](/e:/GSentinelHealthOS/medical-agenda-saas/src/lib/auth.ts)
  - [medical-agenda-saas/middleware.ts](/e:/GSentinelHealthOS/medical-agenda-saas/middleware.ts)

## 18) Access boundaries (estado base)
- Existen boundaries por auth tipo (service/user), scope y tenant.
- Hay endpoints internos con tenant opcional que pueden ampliar superficie si header tenant falta (ver plan/hallazgos).

