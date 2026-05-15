# AGENDA RUNTIME SCHEMA AUDIT

Fecha local: 2026-05-12T21:16:36-03:00

Alcance unico auditado: `E:\GSentinelHealthOS\medical-agenda-saas`

Restricciones respetadas:
- Solo auditoria y documentacion.
- No se aplicaron migraciones.
- No se modifico runtime.
- No se cargaron pacientes reales.
- No se enviaron WhatsApp reales.
- No se borraron tablas.
- No se hizo deploy.
- No se uso `git add .`.

## 1. Resumen ejecutivo

Agenda, dentro de `medical-agenda-saas`, esta implementada como frontend Next.js con API Routes y Prisma. El container activo `gs_frontend` corre Next.js en `127.0.0.1:3000` y usa `DATABASE_URL` apuntando a la base PostgreSQL `gsentinel_saas`.

La base `gsentinel_saas` contiene las tablas Prisma esperadas para Agenda: `patients`, `appointments`, `doctor_profiles`, `availability_rules`, `agenda_settings`, `clinic_whatsapp_accounts`, `incoming_messages`, `outgoing_messages`, `conversation_states`, `rate_limits` y `failed_messages`.

El 500 confirmado no corresponde al backend canonico de Agenda dentro de esta carpeta, sino al servicio externo `gs_api` en `127.0.0.1:8000`, que usa otra base (`gsentinel`) y modelos SQLAlchemy fuera de esta carpeta. Ese API espera columnas/tablas que no existen en `gsentinel`, por ejemplo `patients.date_of_birth` y previamente `doctors`.

Veredicto de esta auditoria: **GO LAB / NO-GO PRODUCCION REAL**.

## 2. Runtime activo relacionado

| Servicio | Container | Puerto | Base/rol | Evidencia |
|---|---|---:|---|---|
| Next Agenda | `gs_frontend` | `127.0.0.1:3000` | UI + API Routes Prisma | `docker compose ps`, `docker inspect gs_frontend` |
| PostgreSQL | `gs_db` | interno `5432/tcp` | DB compartida con dos DB logicas | `docker inspect gs_db`, `psql` read-only |
| FastAPI externo | `gs_api` | `127.0.0.1:8000` | API SQLAlchemy fuera de carpeta | `docker compose ps`, HTTP read-only |

Compose activo detectado: `E:\GSentinelHealthOS\docker-compose.yml`.

Build context del frontend: `./medical-agenda-saas`.

Dockerfile del frontend: `E:\GSentinelHealthOS\medical-agenda-saas\Dockerfile`.

No hay bind mount de codigo en `gs_frontend`; el codigo esta baked dentro de la imagen.

## 3. Backend que usa realmente Agenda

Backend canonico del panel Agenda dentro de `medical-agenda-saas`:
- Next.js App Router API Routes.
- Prisma Client.
- Base: `gsentinel_saas`.
- Modelos fuente: `prisma/schema.prisma`.
- Rutas relevantes:
  - `src/app/api/doctors/route.ts`
  - `src/app/api/patients/route.ts`
  - `src/app/api/appointments/route.ts`
  - `src/app/api/appointments/[id]/route.ts`
  - `src/app/api/schedules/route.ts`
  - `src/app/api/webhooks/whatsapp/route.ts`

SQLAlchemy/FastAPI:
- No se encontraron modelos SQLAlchemy dentro de `medical-agenda-saas`.
- El servicio `gs_api` esta activo pero su codigo esta fuera de esta carpeta y usa la base `gsentinel`.
- Por evidencia de runtime, `gs_api` no debe considerarse backend canonico del panel Agenda hasta que se decida integrarlo formalmente.

Conclusion canonica: **Prisma/Next es el camino canonico para Agenda en esta carpeta**.

## 4. Estado HTTP pasivo

| Endpoint | Resultado | Interpretacion |
|---|---:|---|
| `GET http://127.0.0.1:3000/api/health` | 200 | Frontend/API Next vivo. |
| `GET http://127.0.0.1:3000/api/doctors` | 401 | Protegido por auth, no prueba DB. |
| `GET http://127.0.0.1:3000/api/patients` | 401 | Protegido por auth, no prueba DB. |
| `GET http://127.0.0.1:3000/api/appointments` | 401 | Protegido por auth, no prueba DB. |
| `GET http://127.0.0.1:3000/api/schedules` | 401 | Protegido por auth, no prueba DB. |
| `GET http://127.0.0.1:8000/api/v1/doctors` | 500 | FastAPI externo roto contra `gsentinel`. |
| `GET http://127.0.0.1:8000/api/v1/patients` | 500 | FastAPI externo roto contra `gsentinel`. |
| `GET http://127.0.0.1:8000/api/v1/appointments` | 405 | Metodo no permitido para GET. |

Limitacion: no se ejecuto login ni prueba autenticada porque esta auditoria no debia cargar ni alterar datos. Las rutas Next protegidas quedan pendientes de smoke test autenticado controlado.

## 5. Esquema real de PostgreSQL

### 5.1 Base `gsentinel_saas` usada por Agenda Next/Prisma

Tablas detectadas relevantes:
- `_prisma_migrations`
- `tenants`
- `users`
- `doctor_profiles`
- `agenda_settings`
- `availability_rules`
- `doctor_availability_months`
- `doctor_availability_slots`
- `patients`
- `appointments`
- `clinic_whatsapp_accounts`
- `incoming_messages`
- `outgoing_messages`
- `conversation_states`
- `rate_limits`
- `failed_messages`

Conteos:

| Tabla | Conteo |
|---|---:|
| tenants | 1 |
| users | 2 |
| doctor_profiles | 1 |
| availability_rules | 0 |
| agenda_settings | 0 |
| patients | 1 |
| appointments | 0 |
| appointments source=whatsapp | 0 |
| clinic_whatsapp_accounts | 0 |
| incoming_messages | 0 |
| outgoing_messages | 0 |
| conversation_states | 0 |
| failed_messages | 0 |

Columnas reales principales:

`patients`:
- `id:text`
- `name:text`
- `phone:text`
- `notes:text`
- `created_at:timestamp without time zone`
- `updated_at:timestamp without time zone`
- `tenant_id:text`
- `document:text`
- `insurance:text`

`appointments`:
- `id:text`
- `patient_id:text`
- `doctor_id:text`
- `datetime:timestamp without time zone`
- `duration:integer`
- `status:USER-DEFINED`
- `source:USER-DEFINED`
- `idempotency_key:text`
- `notes:text`
- `deleted_at:timestamp without time zone`
- `created_at:timestamp without time zone`
- `updated_at:timestamp without time zone`
- `tenant_id:text`

`doctor_profiles`:
- `user_id:text`
- `specialty:text`
- `created_at:timestamp without time zone`
- `updated_at:timestamp without time zone`
- `matricula:text`
- `ai_tag:text`
- `tenant_id:text`

`clinic_whatsapp_accounts`:
- `id:text`
- `tenant_id:text`
- `phone_number_id:text`
- `waba_id:text`
- `access_token:text`
- `is_active:boolean`
- `created_at:timestamp without time zone`
- `display_phone_number:text`
- `app_secret:text`
- `verify_token:text`
- `status:text`
- `last_webhook_at:timestamp without time zone`
- `last_error_at:timestamp without time zone`
- `last_error_message:text`
- `updated_at:timestamp without time zone`
- `clinic_id:text`
- `business_id:text`
- `token_type:text`
- `expires_at:timestamp without time zone`
- `webhook_verified:boolean`
- `refresh_token:text`
- `whatsapp_phone_number:text`
- `webhook_verify_token_hash:text`
- `last_authorized_at:timestamp without time zone`
- `last_verified_at:timestamp without time zone`

Migraciones Prisma aplicadas: 18.

### 5.2 Base `gsentinel` usada por FastAPI externo

Tablas detectadas relevantes:
- `alembic_version`
- `clients`
- `clinics`
- `users`
- `patients`
- `appointments`
- `time_slots`
- `resources`
- `client_whatsapp_accounts`

Conteos:

| Tabla | Conteo |
|---|---:|
| tenants | 1 |
| clients | 1 |
| clinics | 1 |
| users | 2 |
| patients | 2 |
| appointments | 0 |
| time_slots | 0 |
| resources | 0 |
| client_whatsapp_accounts | 0 |
| appointments source=whatsapp | 0 |

Columnas reales principales:

`patients`:
- `id:uuid`
- `client_id:uuid`
- `clinic_id:uuid`
- `name:character varying`
- `full_name:character varying`
- `dni:text`
- `phone:text`
- `phone_hash:character varying`
- `email:character varying`
- `age:integer`
- `created_at:timestamp without time zone`
- `updated_at:timestamp without time zone`

`appointments`:
- `id:integer`
- `slot_id:integer`
- `patient_id:integer`
- `status:character varying`
- `created_at:timestamp with time zone`
- `priority:character varying`
- `google_event_id:character varying`
- `google_sync_status:character varying`
- `client_id:uuid`
- `clinic_id:uuid`
- `specialty:character varying`
- `source:character varying`
- `whatsapp_conversation_id:character varying`
- `patient_full_name:character varying`
- `patient_dni:text`
- `patient_phone:text`
- `patient_email:character varying`
- `patient_age:integer`
- `social_security:character varying`

`time_slots`:
- `id:integer`
- `doctor_id:integer`
- `start_time:timestamp with time zone`
- `end_time:timestamp with time zone`
- `status:character varying`
- `created_at:timestamp with time zone`
- `priority_override:character varying`
- `clinic_id:uuid`

`resources`:
- `id:integer`
- `type:character varying`
- `name:character varying`
- `external_ref:character varying`
- `is_active:boolean`
- `created_at:timestamp with time zone`
- `updated_at:timestamp with time zone`

`client_whatsapp_accounts`:
- `id:uuid`
- `client_id:uuid`
- `provider:character varying`
- `phone_number:character varying`
- `phone_number_id:character varying`
- `business_account_id:character varying`
- `access_token_encrypted:text`
- `app_secret_encrypted:text`
- `verify_token:character varying`
- `webhook_enabled:boolean`
- `status:character varying`
- `created_at:timestamp without time zone`
- `updated_at:timestamp without time zone`
- `clinic_id:uuid`
- `meta_business_id:character varying`
- `waba_id:character varying`
- `display_phone_number:character varying`

Alembic version: `20260508_0029`.

## 6. Diferencias modelo vs DB

### Prisma/Next vs `gsentinel_saas`

Estado: mayormente alineado a nivel schema para Agenda.

Tablas presentes:
- `doctor_profiles`
- `patients`
- `appointments`
- `availability_rules`
- `agenda_settings`
- `clinic_whatsapp_accounts`
- `incoming_messages`
- `outgoing_messages`
- `conversation_states`
- `rate_limits`
- `failed_messages`

Riesgos de datos:
- `availability_rules=0`: no hay disponibilidad real configurada.
- `agenda_settings=0`: no hay configuracion de agenda por medico.
- `appointments=0`: no hay historial operativo de turnos.
- `clinic_whatsapp_accounts=0`: WhatsApp no esta conectado.
- `demo_users=1`: existe al menos un usuario con email local/demo.

### FastAPI/SQLAlchemy externo vs `gsentinel`

Estado: no alineado.

Evidencia de logs:
- `sqlalchemy.exc.ProgrammingError`
- `column patients.date_of_birth does not exist`
- evidencia previa/confirmada: `relation "doctors" does not exist`

Riesgo:
- Si algun flujo de Agenda o WhatsApp depende de `gs_api`, puede fallar con 500.
- Este API no debe ser considerado listo para produccion de Agenda.

## 7. Datos demo/local detectados

Codigo:
- `prisma/seed.ts` contiene `secretaria@clinic.local`.
- `prisma/seed.ts` crea `Clinica Demo Local` solo para seed local/lab.
- `src/components/pages/ImportAgenda.jsx` puede generar emails `@import.local`.
- `src/components/pages/ImportAgenda.jsx` usa IDs placeholder `__detected__...` para medico detectado.

DB `gsentinel_saas`:
- `demo_users=1`.
- `demo_tenants=0`.
- `demo_patients=0`.

DB `gsentinel`:
- `demo_users=1`.
- `demo_patients=0`.

Bloqueos requeridos antes de produccion:
- No permitir login/operacion con usuarios `clinic.local`.
- No crear profesionales `import.local` sin revision.
- No convertir placeholders `__detected__...` en agenda real sin validacion humana.
- No ejecutar seed local/lab contra entorno productivo.

## 8. Riesgos estructurales

1. Doble backend conceptual:
   - Agenda Next/Prisma usa `gsentinel_saas`.
   - FastAPI externo usa `gsentinel`.
   - Los modelos no son equivalentes.

2. Produccion no demostrada:
   - Rutas Next protegidas solo fueron probadas sin auth y respondieron 401.
   - Falta smoke test autenticado con tenant real.

3. Disponibilidad no configurada:
   - `availability_rules=0`.
   - `agenda_settings=0`.

4. WhatsApp no configurado:
   - `clinic_whatsapp_accounts=0`.
   - No hay mensajes ni conversaciones.
   - No hay turnos `source=whatsapp`.

5. Auto-scheduling:
   - La ruta de creacion de turnos puede asignar un slot diferente si el pedido no esta disponible.
   - Esto requiere UX/confirmacion explicita antes de produccion real.

6. FastAPI externo roto:
   - `GET /api/v1/doctors` y `GET /api/v1/patients` devuelven 500.
   - No debe usarse como dependencia de Agenda hasta alinear schema.

## 9. Veredicto

**GO LAB**

Motivo:
- El panel canonico Next/Prisma tiene schema presente en `gsentinel_saas`.
- El runtime `gs_frontend` esta vivo y saludable.
- Hay base tecnica para operar pruebas controladas.

**NO-GO PRODUCCION REAL**

Motivo:
- No hay smoke test autenticado de Agenda.
- No hay disponibilidad real configurada.
- No hay cuentas WhatsApp configuradas.
- No hay E2E WhatsApp demostrado.
- Hay datos demo/local activos.
- El API FastAPI externo de agenda/pacientes esta roto contra su DB.
- No hay runbook ni rollback operativo de agenda validado.

