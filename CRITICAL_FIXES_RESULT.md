# Critical Fixes Result

Fecha: 2026-05-15

## Cambios aplicados

- Se creó precheck documental: `AUDIT_CRITICAL_FIXES_PRECHECK.md`.
- Se auditó acceso directo a Prisma en `medical-agenda-saas`: `DATABASE_DIRECT_ACCESS_AUDIT.md`.
- Se auditó duplicación de webhooks WhatsApp: `WHATSAPP_WEBHOOK_DUPLICATION_AUDIT.md`.
- Se creó matriz de scopes/API keys: `SCOPE_VALIDATION_MATRIX.md`.
- Se auditó Agenda API como autoridad explícita futura: `AGENDA_API_AUTHORITY_AUDIT.md`.
- Se endureció `api/app/core/security.py`:
  - `InternalAuth` conserva scopes.
  - `validate_api_key()` devuelve scopes de `API_KEY_SCOPES`.
  - `validate_hybrid_auth()` acepta `required_scope`.
  - `check_permissions()` ya no otorga acceso total a servicios internos.
- Se aplicó validación de scopes existentes en `api/app/api/v1/endpoints/appointments.py`.
- Se bloqueó el webhook FastAPI legacy por defecto con `ENABLE_PY_WHATSAPP_WEBHOOK_PROCESSING=false`.
- Se agregaron tests focales en `tests/unit/test_metabrain_critical_guards.py`.

## Archivos modificados

- `api/app/core/security.py`
- `api/app/api/v1/endpoints/appointments.py`
- `api/app/api/v1/endpoints/webhooks_whatsapp.py`

## Archivos nuevos

- `AUDIT_CRITICAL_FIXES_PRECHECK.md`
- `DATABASE_DIRECT_ACCESS_AUDIT.md`
- `WHATSAPP_WEBHOOK_DUPLICATION_AUDIT.md`
- `SCOPE_VALIDATION_MATRIX.md`
- `AGENDA_API_AUTHORITY_AUDIT.md`
- `CRITICAL_FIXES_RESULT.md`
- `tests/unit/test_metabrain_critical_guards.py`

## Archivos NO tocados

- No se modificó `medical-agenda-saas` en esta fase.
- No se modificó `whatsapp_gateway/api/routes/webhook.py`.
- No se modificó `brain/app.py`.
- No se modificó `docker-compose.yml`.
- No se modificó `.env` ni datos reales.

## Tests y validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `python -m py_compile api/app/core/security.py api/app/api/v1/endpoints/appointments.py api/app/api/v1/endpoints/webhooks_whatsapp.py` | OK en Python global. |
| `.\\.venv_runtime_lab\\Scripts\\python.exe -m py_compile ... tests/unit/test_metabrain_critical_guards.py` | OK. |
| `$env:DEBUG='false'; .\\.venv_runtime_lab\\Scripts\\python.exe -m pytest tests/unit/test_metabrain_critical_guards.py` | OK: 5 passed. |
| `git diff --check` | Falló por `docker-compose.yml:702: new blank line at EOF`, preexistente y fuera de alcance. |
| `git diff --check -- <archivos de esta fase>` | OK. |
| Búsqueda Prisma directa en rutas críticas | Confirma Prisma directo pendiente en Next/WhatsApp. |
| Búsqueda webhooks duplicados | Confirma gateway primario y FastAPI legacy con guard. |
| Búsqueda scopes/auth | Confirma `required_scope` en endpoints de agenda FastAPI. |
| Búsqueda Authorization/Cookie/API keys en logs | No se detectó nuevo log de secretos; aparecen headers construidos para llamadas externas y máscaras existentes. |

Nota de entorno: la primera ejecución de pytest falló porque `pytest` no estaba en PATH global; la segunda con Python global falló por falta de FastAPI. El venv del repo funcionó, con override temporal `DEBUG=false` porque `.env` local contiene `DEBUG=release`.

## Riesgos restantes

- `medical-agenda-saas` sigue accediendo directo a BD con Prisma.
- WhatsApp Next/Prisma sigue mezclando conversación y agenda en `src/lib/whatsapp/conversation-engine.ts`.
- Faltan scopes formales para update/cancel/reschedule; se usaron solo scopes existentes como guard mínimo donde era compatible.
- Endpoints internos de pacientes y `brain_decide` todavía requieren scope granular.
- Brain standalone `/orchestrate` sigue protegido por API key si `INTERNAL_SERVICES_KEY` existe, sin registry local de scopes.
- El worktree sigue con muchos cambios previos no relacionados.

## Rollback

- Revertir `api/app/core/security.py`, `api/app/api/v1/endpoints/appointments.py` y `api/app/api/v1/endpoints/webhooks_whatsapp.py` a su versión previa si un cliente interno falla por scope.
- Para reactivar webhook FastAPI legacy: setear explícitamente `ENABLE_PY_WHATSAPP_WEBHOOK_PROCESSING=true` además de `ENABLE_PY_WHATSAPP_WEBHOOK=true`.
- Los reportes y tests pueden eliminarse sin impacto runtime si se decide no conservar documentación.

## Próximos pasos

1. Definir scopes formales `appointments:update`, `appointments:cancel`, `patients:write` sin romper clientes.
2. Aplicar scopes a `patients.py` y `brain_decide.py`.
3. Crear cliente HTTP de Agenda API en `medical-agenda-saas` en modo shadow/paridad.
4. Migrar primero WhatsApp a Agenda API HTTP.

## Confirmación explícita

- NO deploy.
- NO restart.
- NO producción.
- NO datos reales modificados.
- NO duplicación de Brain.
- NO creación de MB-Chat, MB-Secretaria ni MB-Whatsapp.
- NO commit automático.

## Stage selectivo recomendado

Archivos nuevos seguros:

```powershell
git add AUDIT_CRITICAL_FIXES_PRECHECK.md
git add DATABASE_DIRECT_ACCESS_AUDIT.md
git add WHATSAPP_WEBHOOK_DUPLICATION_AUDIT.md
git add SCOPE_VALIDATION_MATRIX.md
git add AGENDA_API_AUTHORITY_AUDIT.md
git add CRITICAL_FIXES_RESULT.md
git add tests/unit/test_metabrain_critical_guards.py
```

Archivos de código con cambios previos en el worktree: revisar y stagear por hunk para no mezclar autorías.

```powershell
git add -p api/app/core/security.py
git add -p api/app/api/v1/endpoints/appointments.py
git add -p api/app/api/v1/endpoints/webhooks_whatsapp.py
```

Mensaje sugerido:

```text
Harden MetaBrain separation critical guards
```
