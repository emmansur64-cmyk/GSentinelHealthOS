# BLOQUE B — TENANT ISOLATION AUDIT

Fecha: 2026-05-16

## Evidencia de aislamiento real

### 1) RLS real en runtime
- Consulta `pg_class` en `gs_db` confirma `relrowsecurity=true` y `relforcerowsecurity=true` en:
  - `appointments`
  - `patients`
  - `clinic_members`
  - `client_whatsapp_accounts`
  - `google_outbox`
  - `notification_outbox`
  - `bot_knowledge_base`
- Consulta `pg_policies` confirma policy `rls_clinic_isolation` con condición basada en:
  - `current_setting('app.current_clinic_id', true)`
  - `current_setting('app.tenant_bypass', true)`

### 2) Session scope DB por request
- API setea contexto por sesión DB:
  - [api/app/dependencies/db.py](/e:/GSentinelHealthOS/api/app/dependencies/db.py)
  - `set_config('app.current_client_id', ...)`
  - `set_config('app.current_clinic_id', ...)`
  - `set_config('app.tenant_bypass', '0', false)`

### 3) Tenant filters en aplicación
- Validación de headers tenant y consistencia con claims:
  - [api/app/dependencies/tenant.py](/e:/GSentinelHealthOS/api/app/dependencies/tenant.py)
- SaaS propaga `x-tenant-id` desde middleware:
  - [medical-agenda-saas/middleware.ts](/e:/GSentinelHealthOS/medical-agenda-saas/middleware.ts)

### 4) API scope y service scope
- Auth híbrida por scope (`appointments:*`, etc.) y tipo:
  - [api/app/core/security.py](/e:/GSentinelHealthOS/api/app/core/security.py)
  - [api/app/api/v1/endpoints/appointments.py](/e:/GSentinelHealthOS/api/app/api/v1/endpoints/appointments.py)

### 5) WhatsApp scope
- Resolución tenant por `phone_number_id` en webhook SaaS:
  - [medical-agenda-saas/src/app/api/webhooks/whatsapp/route.ts](/e:/GSentinelHealthOS/medical-agenda-saas/src/app/api/webhooks/whatsapp/route.ts)
- Guard por API key en MB-Whatsapp ingress:
  - [MB-Whatsapp/src/ingress/guards/api-key.guard.ts](/e:/GSentinelHealthOS/MB-Whatsapp/src/ingress/guards/api-key.guard.ts)

### 6) Chat/IA scope
- Contexto IA se arma con tenant/doctor/paciente en múltiples puntos SaaS:
  - [medical-agenda-saas/src/lib/groq-doctor-chat.ts](/e:/GSentinelHealthOS/medical-agenda-saas/src/lib/groq-doctor-chat.ts)
  - [medical-agenda-saas/src/lib/whatsapp/metabrain-assistant.ts](/e:/GSentinelHealthOS/medical-agenda-saas/src/lib/whatsapp/metabrain-assistant.ts)

## Riesgos de aislamiento detectados

1. Riesgo de acceso cruzado por tenant opcional en endpoints internos (ALTO)  
Evidencia: uso de `get_tenant_context_optional` en rutas de appointments y forwarding de `clinic_id/client_id` opcionales.

2. Cobertura RLS parcial por tabla (MEDIO/ALTO según caso)  
Evidencia: tablas con `clinic_id` como `doctor_schedule_config`, `time_slots`, `users` no muestran RLS activo en consulta runtime realizada.

3. Dependencia de disciplina de capa app para queries no cubiertas por RLS (ALTO)  
Si falla filtro de app en tablas sin RLS, aumenta riesgo de fuga cruzada.

4. Riesgo de fuga de contexto IA por sobreinclusión de metadata (MEDIO/ALTO)  
Hay sanitización y clipping, pero el contexto puede incluir más datos clínicos de los estrictamente necesarios.

## Confirmación de riesgos solicitados

- Acceso cruzado: **riesgo presente (alto)** en paths con tenant opcional + tablas sin RLS total.
- Fuga de pacientes: **riesgo presente (alto)** en escenarios de filtros app incompletos.
- Fuga de clínicas: **riesgo presente (alto)** por mismo vector.
- Fuga de conversaciones: **riesgo medio** (depende de storage/queries y sanitización aplicada).
- Fuga de historiales: **riesgo medio/alto** por payload/contexto IA y controles por endpoint.
- Fuga de imágenes: **riesgo medio** (hay validaciones, pero depende del flujo final y retención).
- Fuga de prompts/contextos: **riesgo medio/alto** si contexto no se minimiza estrictamente antes de salida a proveedor externo.

## Qué no pudo validarse completamente sin violar restricciones
- No se ejecutaron pruebas activas con usuarios/tenants reales ni modificación de datos.
- No se realizó barrido exhaustivo endpoint-por-endpoint con credenciales reales por rol/tenant.
- No se validó cada tabla con potencial dato PHI contra políticas de retención y cifrado en reposo a nivel infraestructura externa.

