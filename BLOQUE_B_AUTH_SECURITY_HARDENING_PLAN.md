# BLOQUE B — AUTH & SECURITY HARDENING PLAN

Fecha: 2026-05-16

## Orden exacto de ejecución

1. Corregir fallo de guard en endpoint interno de validación de slot.  
2. Exigir `X-Clinic-Id` en endpoint interno de validación de slot.  
3. Validar no regresión sin restart/deploy.  
4. Documentar pendientes de alto impacto no aplicables sin aprobación.

## Plan por hallazgo

### H1
- Hallazgo: endpoint `validate_slot_gateway` usa `request` sin parámetro definido.
- Riesgo: ALTO (guard puede fallar en runtime, degradando control de acceso).
- Archivo afectado: [api/app/api/v1/endpoints/appointments.py](/e:/GSentinelHealthOS/api/app/api/v1/endpoints/appointments.py)
- Cambio propuesto: agregar `request: Request` a la firma y mantener `validate_api_key`.
- Validación: llamada POST anónima debe responder controladamente (422 por header faltante), sin 500.
- Rollback: restaurar backup `appointments.py.bak.BLOQUE_B_<timestamp>`.
- Dependencias: ninguna migración.
- Impacto operacional: bajo.
- Riesgo clínico: reduce bypass accidental de guard.
- Prioridad: P0.
- Qué NO tocar: signing JWT, sesiones activas, puertos, credenciales.

### H2
- Hallazgo: endpoint interno acepta tenant opcional.
- Riesgo: ALTO (superficie de acceso cruzado por falta de `clinic_id` explícito).
- Archivo afectado: [api/app/api/v1/endpoints/appointments.py](/e:/GSentinelHealthOS/api/app/api/v1/endpoints/appointments.py)
- Cambio propuesto: denegar cuando `tenant.clinic_id` no esté presente en `validate_slot_gateway`.
- Validación: petición sin `X-Clinic-Id` debe ser rechazada.
- Rollback: restaurar backup.
- Dependencias: clientes internos deben enviar `X-Clinic-Id`.
- Impacto operacional: bajo/medio (puede exigir ajuste de caller que no enviaba header).
- Riesgo clínico: reduce riesgo de mezcla interclínica.
- Prioridad: P0.
- Qué NO tocar: reglas de negocio de asignación de turnos.

### H3
- Hallazgo: secretos en compose efectivo y warnings de variables sensibles no seteadas para panel.
- Riesgo: CRÍTICO/ALTO (exposición operacional y config incompleta).
- Archivo afectado: `docker-compose.yml`, gestión de secretos externa.
- Cambio propuesto: no aplicar en este ciclo sin aprobación explícita (impacto transversal).  
  Definir migración a secret store (Docker secrets/Vault/SOPS) en bloque dedicado.
- Validación: revisión de configuración sin exponer valores.
- Rollback: N/A (no cambio aplicado).
- Dependencias: Bloque Infra + Plataforma.
- Impacto operacional: alto.
- Riesgo clínico: alto indirecto (compromiso de credenciales).
- Prioridad: P0 pendiente.
- Qué NO tocar: credenciales activas sin plan de rotación.

### H4
- Hallazgo: cobertura RLS no total en tablas con `clinic_id`.
- Riesgo: ALTO.
- Archivo afectado: migraciones alembic y consultas por servicio.
- Cambio propuesto: no aplicar masivamente sin ventana controlada y pruebas de regresión de autorización.
- Validación: SQL por tabla + test matrix por rol/tenant.
- Rollback: downgrade de migración específica + backup de esquema.
- Dependencias: DBA + backend.
- Impacto operacional: medio/alto.
- Riesgo clínico: alto (fuga de PHI entre tenants).
- Prioridad: P0 pendiente.
- Qué NO tocar: schemas en caliente sin backup + test.

### H5
- Hallazgo: riesgo de sobreinclusión de contexto PHI hacia Groq.
- Riesgo: ALTO.
- Archivo afectado: [medical-agenda-saas/src/lib/groq-doctor-chat.ts](/e:/GSentinelHealthOS/medical-agenda-saas/src/lib/groq-doctor-chat.ts) y builders de contexto.
- Cambio propuesto: siguiente iteración con minimización estricta y allowlist de campos por caso de uso.
- Validación: pruebas unitarias de payload + auditoría de logs.
- Rollback: feature-flag de contexto ampliado.
- Dependencias: IA Safety + Clinical governance.
- Impacto operacional: medio.
- Riesgo clínico: alto.
- Prioridad: P1 pendiente.
- Qué NO tocar: activación clínica automática.

