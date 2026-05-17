# BLOQUE B — AUTH & SECURITY HARDENING RESULT

Fecha: 2026-05-16  
Estado final del bloque: **parcial**

## 1) Estado inicial
- Estado declarado del bloque: parcial.
- Riesgo inicial: alto.
- Runtime activo y saludable (contenedores `gs_*` en estado `Up`).

## 2) Hallazgos
- H1 ALTO: bug en guard interno (`validate_slot_gateway` usaba `request` no definido).
- H2 ALTO: endpoint interno aceptaba ausencia de `clinic_id` (tenant opcional).
- H3 CRÍTICO/ALTO: secretos en compose efectivo y variables sensibles de panel sin seteo.
- H4 ALTO: cobertura RLS parcial sobre tablas con `clinic_id`.
- H5 ALTO: riesgo de sobreexposición de contexto clínico hacia IA externa.
- H6 MEDIO: no se evidenció refresh-token strategy dedicada en API principal.
- H7 MEDIO: trazabilidad/auditoría distribuida heterogénea entre componentes.

## 3) Riesgos clasificados
- Crítico: gestión de secretos operativos en configuración efectiva.
- Alto: aislamiento tenant parcial, exposición PHI por contexto IA, guard defectuoso (corregido).
- Medio: consistencia de trazabilidad, estrategia refresh.
- Bajo: no se detectaron reinicios no autorizados ni operaciones destructivas.

## 4) Cambios aplicados (seguros y reversibles)
- Archivo modificado: [api/app/api/v1/endpoints/appointments.py](/e:/GSentinelHealthOS/api/app/api/v1/endpoints/appointments.py)
  1. Se agregó `request: Request` a `validate_slot_gateway`.
  2. Se agregó rechazo explícito cuando falta `tenant.clinic_id`.
- Backup previo creado:
  - `api/app/api/v1/endpoints/appointments.py.bak.BLOQUE_B_20260516_130931`
- Diff aplicado documentado por `git diff`.

## 5) Cambios NO aplicados
- No se cambió signing JWT activo.
- No se tocaron sesiones activas ni refresh global.
- No se cambiaron secretos activos.
- No se aplicaron cambios masivos de RLS.
- No se realizaron migraciones de esquema.
- No se modificaron roles masivamente.

## 6) Riesgos pendientes
- R1: hardcoded/secret exposure en compose/config runtime.
- R2: tablas multi-tenant sin RLS forzado completo.
- R3: minimización de payload clínico saliente a Groq pendiente de endurecimiento adicional.
- R4: validación e2e por rol/tenant incompleta en esta corrida.

## 7) Validaciones ejecutadas (no destructivas)
- `docker compose config --quiet`: válido (con warnings por variables panel no seteadas).
- `docker ps`: servicios principales `healthy`.
- Runtime auth checks previos:
  - `GET /api/v1/auth/session` -> 401.
  - `GET /api/v1/patients/` -> 403.
  - `POST /api/v1/auth/token` con credenciales inválidas -> 401; en ráfaga -> 429.
- CORS:
  - origen no permitido -> 400.
  - origen permitido -> 200.
- CSRF:
  - solicitud mutante con cookie auth simulada y sin token válido -> 403.
- Endpoint endurecido:
  - `POST /api/v1/appointments/gateway/validate-slot` sin headers requeridos -> 422 (controlado, sin 500).
- SQL runtime en PostgreSQL:
  - consulta de `pg_class` y `pg_policies` para evidenciar RLS/policies activas.
- `git diff` verificado sobre archivo editado.

## 8) Resultado de validaciones
- Sin restart.
- Sin deploy.
- Sin caída de runtime.
- Cambio aplicado es reversible por archivo backup.

## 9) Rollback
1. Restaurar backup:
   - copiar `api/app/api/v1/endpoints/appointments.py.bak.BLOQUE_B_20260516_130931` sobre `api/app/api/v1/endpoints/appointments.py`.
2. Verificar diff limpio del archivo.
3. Re-ejecutar validación no destructiva de endpoint (sin reiniciar servicios).

## 10) Dependencias con otros bloques
- Bloque A/Core Infra: secret management y runtime config governance.
- Bloque DB/RLS: cobertura completa de políticas por tabla sensible.
- Bloque IA Safety: minimización de contexto y PHI outbound.

## 11) Próximo bloque recomendado
- Priorizar sub-bloque de **Secret Management + Tenant/RLS Completion** antes de ampliar funcionalidades clínicas.

## 12) Confirmaciones explícitas
- no deploy: **confirmado**
- no restart: **confirmado**
- no migraciones destructivas: **confirmado**
- no exposición de secretos: **confirmado en reportes**
- no activación IA clínica: **confirmado**
- no cambios destructivos: **confirmado**
- no pérdida de sesiones: **confirmado**
- no ruptura de runtime: **confirmado**

---

## Criterio de completado del bloque

**BLOQUE B NO COMPLETO**

Falta exactamente:
1. Cierre de auditoría JWT con estrategia de refresh formal validada extremo a extremo.
2. Matriz completa de auditoría por rol (`doctor/paciente/secretaria/admin/superadmin`) en todos los endpoints críticos.
3. Cobertura completa de aislamiento tenant con RLS para todas las tablas con dato sensible o `clinic_id`.
4. Endurecimiento efectivo de secret management (sin secretos expuestos en configuración efectiva).
5. Pruebas controladas de payload IA con minimización estricta de PHI por caso de uso.
6. Validación integral MB-Chat/MB-Secretaria/MB-Whatsapp auth flows con evidencia runtime específica por servicio.

