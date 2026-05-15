# HARDENED BUILD REPORT
**Timestamp de build:** 2026-05-12 21:48 ART  
**Tag base:** `hardened-20260512-2137`  
**Estado:** BUILDS COMPLETOS ✅

---

## IMÁGENES HARDENED PRODUCIDAS

### API — Python/FastAPI

| Campo | Valor |
|-------|-------|
| Repositorio | `gsentinelhealthos/api` |
| Tag inmutable | `hardened-20260512-2137` |
| Tag alias | `hardened-latest` |
| Image ID (short) | `de6cb70abf81` |
| SHA-256 completo | `sha256:de6cb70abf815a2d2cc2e01f03e93dc9adcd3a0c5e034e2c29bf96a26e00eefe` |
| Tamaño | 1.18 GB |
| Creada | 2026-05-13T00:48:17Z |
| Fuente | `docker/api.Dockerfile` |
| Contexto | `e:/GSentinelHealthOS/` |

**Cambios de seguridad incluidos:**
- Auth obligatoria en patients, doctors, slots, buffer_slots (validate_hybrid_auth)
- Tenant hard fail clinic_id=None → HTTP 403
- OAuth2 CSRF: state HMAC-SHA256 firmado con TTL 600s
- WebSocket JWT via cookie (gs_access_token + auth_token legacy)
- PHI logging eliminado (email/phone de logger.info/error)
- buffer_slots registrado en main.py con auth
- Prefijo slots corregido (/api/v1/slots sin duplicación)
- Optional[Request] → Request en validate_hybrid_auth

### Frontend — Next.js

| Campo | Valor |
|-------|-------|
| Repositorio | `gsentinelhealthos/web` |
| Tag inmutable | `hardened-20260512-2137` |
| Tag alias | `hardened-latest` |
| Image ID (short) | `b53391587903` |
| SHA-256 completo | `sha256:b53391587903240b6eb2b4c693cc46e85251fbac6f199188cd640c630185f872` |
| Tamaño | 399 MB |
| Creada | 2026-05-13T00:47:51Z |
| Fuente | `medical-agenda-saas/Dockerfile` |
| Contexto | `e:/GSentinelHealthOS/medical-agenda-saas/` |

**Cambios de seguridad incluidos:**
- app_secret cifrado con encryptText() antes de persistir en DB
- groq-doctor-chat.ts: phone eliminado del contexto enviado a Groq
- WebSocket dual-cookie (gs_access_token + auth_token legacy)

⚠️ **NOTA:** `chat.service.ts` fue modificado externamente durante la sesión y conserva `phone: true` en el SELECT de Prisma. El campo `phone` es seleccionado de la DB pero NO transmitido a Groq (bloqueado en formatContext en groq-doctor-chat.ts). Riesgo residual: el campo phone viaja en el objeto `sharedContext` interno pero no llega al LLM externo.

---

## COMPARATIVA CON IMÁGENES DE PRODUCCIÓN ACTUALES

| Imagen | Producción (OLD) | Hardened (NEW) |
|--------|-----------------|----------------|
| API | `d9868f3e26ba` (2026-05-08) | `de6cb70abf81` (2026-05-12) |
| Frontend | `c1eef26b3087` → `283589541a44`* | `b53391587903` (2026-05-12) |

*El tag `gsentinelhealthos-frontend:latest` fue actualizado durante la sesión de build.

---

## VERIFICACIÓN ANTI-SOBREESCRITURA

Los tags `hardened-20260512-2137` son **INMUTABLES** — no existe proceso que los actualice automáticamente. El tag `hardened-latest` apunta al mismo digest y sirve como referencia rápida.

Para confirmar inmutabilidad del tag timestamped:
```bash
docker inspect gsentinelhealthos/api:hardened-20260512-2137 --format '{{.Id}}'
# Siempre debe devolver: sha256:de6cb70abf815a2d...
```

---

## COMANDOS DE INSPECCIÓN

```bash
# Verificar API hardened
docker inspect gsentinelhealthos/api:hardened-20260512-2137 \
  --format 'ID={{.Id}} | Created={{.Created}}'

# Verificar Frontend hardened
docker inspect gsentinelhealthos/web:hardened-20260512-2137 \
  --format 'ID={{.Id}} | Created={{.Created}}'

# Listar todas las imágenes hardened
docker images | grep hardened
```

---

## FASE 3: COMPLETADA ✅
