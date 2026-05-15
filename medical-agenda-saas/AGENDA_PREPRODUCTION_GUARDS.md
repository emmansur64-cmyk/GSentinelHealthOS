# AGENDA PREPRODUCTION GUARDS

Fecha local: 2026-05-12

Scope unico: `E:\GSentinelHealthOS\medical-agenda-saas`

## Riesgos a bloquear antes de produccion

| Riesgo | Estado | Guard requerido |
|---|---|---|
| `clinic.local` | detectado en seeds/tests | hard-fail si existe en DB productiva |
| `import.local` | detectado en ImportAgenda | no crear profesionales reales con email importado sin revision |
| `Clinica Demo Local` | detectado en seed local | seed prohibido en produccion |
| `default tenant` silencioso | existe en codigo como fallback | exigir tenant explicito fuera de lab |
| `tenant fallback permissive` | riesgo operacional | `TENANT_LEGACY_FALLBACK_MODE=strict` o equivalente |
| placeholders `__detected__` | detectados en importacion | bloquear persistencia directa |
| auto-reasignacion silenciosa | detectada en appointments | corregido en fuente, pendiente runtime |
| cookies Secure en HTTP LAB | observado | documentar o usar HTTPS/local proxy en smoke |

## Startup guards recomendados

Hard-fail en `NODE_ENV=production` si:
- existe usuario con email `%clinic.local%`;
- existe usuario o profesional con `%import.local%`;
- existe tenant `Clinica Demo Local`;
- `DEFAULT_TENANT_ID=default` sin tenant explicito;
- `TENANT_LEGACY_FALLBACK_MODE` no esta en modo estricto;
- `DATABASE_URL` no apunta a `gsentinel_saas` para frontend;
- `WHATSAPP_APP_SECRET` falta cuando WhatsApp esta activo;
- `clinic_whatsapp_accounts` tiene tokens dummy `LAB_TEST_%`;
- existen placeholders `__detected__` en flujos de importacion persistidos.

## Env validation

Variables obligatorias para Agenda produccion controlada:
- `DATABASE_URL` apuntando a `gsentinel_saas`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `REDIS_URL`
- `NODE_ENV=production`
- `TENANT_LEGACY_FALLBACK_MODE=strict` o equivalente

Variables obligatorias para WhatsApp produccion controlada:
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_VERIFY_TOKEN`
- cuenta activa en `clinic_whatsapp_accounts`
- `phone_number_id`
- token cifrado y no dummy

## Logs sanitizados

No loguear:
- access tokens;
- app secrets;
- JWT;
- telefonos completos de pacientes reales;
- payloads completos de WhatsApp con PHI.

Si loguear:
- trace id;
- tenant id;
- message id;
- estado;
- causa de fallo sanitizada;
- conteos y latencias.

## Checklist pre-release

1. `npx tsc --noEmit --incremental false --project tsconfig.json` PASS.
2. `npm run build` PASS.
3. Smoke autenticado Agenda manual PASS.
4. Crear turno PASS.
5. Cancelar turno PASS.
6. Overlap retorna 409 PASS.
7. No auto-reasignacion silenciosa PASS.
8. Tenant isolation positiva/negativa PASS.
9. WhatsApp inbound PASS.
10. WhatsApp E2E sandbox PASS.
11. Sin `clinic.local`/`import.local`/demo en DB productiva.
12. Rollback DB documentado.
13. Runbook operativo aprobado.

