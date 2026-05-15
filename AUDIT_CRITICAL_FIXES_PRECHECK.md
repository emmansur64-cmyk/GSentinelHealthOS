# Audit Critical Fixes Precheck

Fecha/hora: 2026-05-15T08:42:09.7610480-03:00

## Rama

`GsentinelH`

## Estado inicial de git

El worktree no estaba limpio al iniciar esta fase. Se detectaron cambios modificados, eliminados y muchos archivos no versionados preexistentes. Esta intervención no revertirá cambios previos ni hará commits automáticos.

Resumen observado:

- Archivos modificados relevantes ya presentes: `api/app/main.py`, `api/app/core/security.py`, `api/app/dependencies/tenant.py`, varios endpoints FastAPI, `brain/app.py`, `brain/orchestration/*`, `medical-agenda-saas/src/app/api/appointments/*`, `medical-agenda-saas/src/chat/chat.service.ts`, `medical-agenda-saas/src/lib/brain-client.ts`, `medical-agenda-saas/src/lib/whatsapp/conversation-engine.ts`, `docker-compose.yml`, `.env.example`.
- Archivo eliminado preexistente: `scripts/build-dashboard-ui-optimized.ps1`.
- Directorios/archivos no versionados relevantes: `api/tests/`, `brain/contracts/`, `brain/routing/`, `brain/tests/`, múltiples reportes de auditoría y runtime, módulos médicos nuevos bajo `medical-agenda-saas/src/lib/*`.

## Archivos candidatos a tocar

- `AUDIT_CRITICAL_FIXES_PRECHECK.md`
- `DATABASE_DIRECT_ACCESS_AUDIT.md`
- `WHATSAPP_WEBHOOK_DUPLICATION_AUDIT.md`
- `SCOPE_VALIDATION_MATRIX.md`
- `AGENDA_API_AUTHORITY_AUDIT.md`
- `CRITICAL_FIXES_RESULT.md`
- `api/app/core/security.py`
- `api/app/api/v1/endpoints/appointments.py`
- `api/app/api/v1/endpoints/webhooks_whatsapp.py`
- tests focales bajo `api/tests/`, `brain/tests/` o `tests/unit/` si el stack existente lo permite.

## Riesgos detectados

- `medical-agenda-saas` usa Prisma directo desde rutas, repositorios y servicios; esto impide que Agenda API sea autoridad única todavía.
- Existen dos puntos de webhook WhatsApp: gateway dedicado y endpoint FastAPI legado.
- Hay definición de API keys/scopes en FastAPI, pero los endpoints de agenda usan autenticación híbrida sin validación granular de scope por acción.
- Brain expone endpoint interno protegido por API key, pero el contrato de role/mode es la barrera principal para evitar mezcla clínica/secretaría/WhatsApp.
- El worktree contiene cambios previos extensos; cualquier corrección debe ser mínima y reversible.

## Confirmación operativa

- No se hizo deploy.
- No se reiniciaron contenedores.
- No se modificaron datos reales.
- No se creó MB-Chat, MB-Secretaria ni MB-Whatsapp.
- No se duplicó Brain.
- No se commiteó nada automáticamente.
