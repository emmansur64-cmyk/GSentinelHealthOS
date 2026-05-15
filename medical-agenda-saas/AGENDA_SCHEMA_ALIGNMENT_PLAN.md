# AGENDA SCHEMA ALIGNMENT PLAN

Fecha local: 2026-05-12T21:16:36-03:00

Alcance unico: `E:\GSentinelHealthOS\medical-agenda-saas`

Estado: plan documental. No ejecutado.

## 1. Decision tecnica recomendada

Para Agenda dentro de `medical-agenda-saas`, el camino canonico recomendado es:

**Next.js API Routes + Prisma + PostgreSQL `gsentinel_saas`**

Razon:
- El frontend activo `gs_frontend` esta construido desde `medical-agenda-saas`.
- Las rutas del panel importan `@/lib/prisma`.
- `prisma/schema.prisma` modela las entidades requeridas por la Agenda.
- La base `gsentinel_saas` tiene 18 migraciones Prisma aplicadas y contiene las tablas esperadas.

FastAPI/SQLAlchemy (`gs_api` + DB `gsentinel`) debe tratarse como servicio externo/legacy para Agenda hasta que sea alineado explicitamente. No conviene mezclarlo como backend operativo del panel sin una decision de arquitectura.

## 2. Objetivo de alineacion

Dejar Agenda estable para laboratorio operativo, y luego para produccion controlada, sin cambios destructivos:

1. Mantener `gsentinel_saas` como DB canonica del panel Agenda.
2. Probar rutas Next autenticadas contra `gsentinel_saas`.
3. Crear configuracion minima real de tenant, doctor, agenda settings y availability rules.
4. Bloquear datos demo/local antes de produccion.
5. Probar WhatsApp E2E con cuenta controlada.
6. Separar o corregir FastAPI externo para que no genere falsos positivos de agenda rota.

## 3. Migraciones necesarias

### 3.1 Prisma/Agenda canonica

Schema migration obligatoria inmediata: **ninguna confirmada**.

Evidencia:
- `patients`, `appointments`, `doctor_profiles`, `availability_rules`, `agenda_settings`, `clinic_whatsapp_accounts`, `incoming_messages`, `outgoing_messages`, `conversation_states`, `rate_limits` y `failed_messages` existen en `gsentinel_saas`.
- Las columnas principales coinciden con `prisma/schema.prisma`.

Pendientes no destructivos:
- Crear o validar data/config operativa, no schema:
  - availability rules por medico.
  - agenda settings por medico.
  - cuenta WhatsApp por tenant solo en lab.
  - usuario no demo.

### 3.2 FastAPI/SQLAlchemy externo

Si el negocio decide que `gs_api` tambien debe servir Agenda, se requiere un plan separado fuera del alcance de esta carpeta.

Opciones:

Opcion A - Recomendado:
- No usar `gs_api` como backend de Agenda.
- Mantenerlo fuera del camino critico del panel.
- Documentar que `127.0.0.1:8000/api/v1/doctors` y `patients` no son fuente de verdad de Agenda.

Opcion B - No ejecutar todavia:
- Alinear `gsentinel` con los modelos SQLAlchemy reales.
- Resolver columnas faltantes como `patients.date_of_birth`.
- Resolver tabla faltante `doctors` si endpoints la requieren.
- Revisar tipos incompatibles de `appointments.patient_id` y modelos de slots.

## 4. SQL/migration propuesta

### 4.1 Para `gsentinel_saas` / Prisma

No aplicar migracion de schema hasta que pase smoke test autenticado.

Validaciones read-only propuestas:

```sql
SELECT current_database();
SELECT COUNT(*) FROM tenants;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM doctor_profiles;
SELECT COUNT(*) FROM availability_rules;
SELECT COUNT(*) FROM agenda_settings;
SELECT COUNT(*) FROM patients;
SELECT COUNT(*) FROM appointments;
SELECT COUNT(*) FROM clinic_whatsapp_accounts;
SELECT COUNT(*) FROM incoming_messages;
SELECT COUNT(*) FROM conversation_states;
```

Data/config controlada propuesta para lab, no para produccion directa:

```sql
-- NO EJECUTAR EN PRODUCCION SIN BACKUP Y APROBACION.
-- Ejemplo conceptual: crear availability_rules y agenda_settings para medico existente.
-- Debe transformarse en Prisma migration/seed de lab o script idempotente.

-- availability_rules:
-- INSERT INTO availability_rules (id, tenant_id, doctor_id, day_of_week, start_time, end_time, slot_duration, created_at, updated_at)
-- VALUES (...);

-- agenda_settings:
-- INSERT INTO agenda_settings (user_id, tenant_id, appointment_duration, buffer_minutes, start_time, end_time, working_days, created_at, updated_at)
-- VALUES (...);
```

### 4.2 Para bloquear demo/local antes de produccion

No ejecutar automaticamente. Primero listar y revisar:

```sql
SELECT id, tenant_id, email, role
FROM users
WHERE lower(email) LIKE '%clinic.local%'
   OR lower(email) LIKE '%import.local%';
```

Accion futura:
- Desactivar o reemplazar usuarios demo con usuarios reales.
- Prohibir seeds local/lab en produccion.
- Agregar gate CI/runtime que falle si existen emails `clinic.local` o `import.local` en entorno productivo.

## 5. Rollback

Como no se ejecuta ninguna migracion en esta fase:
- Rollback actual: no aplica.

Rollback futuro para cambios de schema:
1. Backup de DB antes de migrar.
2. Export de `pg_dump --schema-only` y `pg_dump` por tablas criticas.
3. Migracion Prisma versionada.
4. Smoke test.
5. Si falla, restaurar snapshot o aplicar migration down manual validada.

Rollback futuro para data/config:
1. Registrar IDs creados.
2. Borrar solo filas creadas en lab si falla.
3. No borrar pacientes/turnos reales.
4. No usar `TRUNCATE`.

## 6. Impacto esperado

| Cambio futuro | Impacto | Endpoint desbloqueado |
|---|---|---|
| Configurar `availability_rules` | Permite disponibilidad real por medico | `/api/schedules`, `/api/appointments` |
| Configurar `agenda_settings` | Defaults operativos por medico | `/api/doctors`, UI Agenda |
| Eliminar/bloquear demo users | Reduce riesgo de operacion no real | login, audit, tenant isolation |
| Configurar `clinic_whatsapp_accounts` lab | Habilita resolucion de tenant por webhook | `/api/webhooks/whatsapp` |
| Smoke autenticado | Confirma que Prisma schema funciona en runtime | `/api/doctors`, `/api/patients`, `/api/appointments`, `/api/schedules` |
| Separar FastAPI legacy | Evita confundir 500 externos con estado de Agenda | `127.0.0.1:8000/api/v1/*` |

## 7. Pruebas de validacion

Fase lab, sin datos reales:

1. Login con usuario no demo.
2. `GET /api/doctors` autenticado debe devolver 200.
3. `GET /api/patients` autenticado debe devolver 200.
4. `GET /api/schedules` autenticado debe devolver 200.
5. Crear paciente test, no real.
6. Crear availability rule test.
7. Crear turno test manual.
8. Validar overlap bloqueado.
9. Validar drag/drop o resize no permite solapamientos.
10. Validar auditoria funcional.
11. Validar que no se crea turno si tenant no corresponde.
12. Validar WhatsApp con numero y cuenta sandbox/controlada.

## 8. Criterios de promocion

### GO LAB

Permitido cuando:
- Runtime Next vivo.
- DB `gsentinel_saas` alineada a Prisma.
- Se usan pacientes test.
- No hay WhatsApp real.

Estado actual: **GO LAB**.

### GO PRODUCCION CONTROLADA

Requiere:
- Rutas Next autenticadas sin 500.
- Tenant real creado.
- Usuarios demo removidos o bloqueados.
- Availability rules reales.
- Agenda settings reales.
- Backup y rollback.
- Runbook de operacion.
- WhatsApp sandbox probado, sin pacientes reales masivos.

Estado actual: **NO-GO**.

### GO PRODUCCION REAL

Requiere:
- Cero 500 en endpoints de Agenda.
- DB y modelos alineados.
- Auth y tenant isolation validados.
- WhatsApp E2E controlado aprobado.
- Sin datos demo/local activos.
- Rollback probado.
- Runbook aprobado.

Estado actual: **NO-GO PRODUCCION REAL**.

