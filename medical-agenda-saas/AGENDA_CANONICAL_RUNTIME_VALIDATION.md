# AGENDA CANONICAL RUNTIME VALIDATION

Fecha local: 2026-05-12

Scope unico: `E:\GSentinelHealthOS\medical-agenda-saas`

## Resultado

Veredicto: **GO LAB / NO-GO PRODUCCION REAL**

## Evidencia runtime

Comandos de solo lectura ejecutados:
- `docker compose -f E:\GSentinelHealthOS\docker-compose.yml ps`
- `docker inspect gs_frontend`
- `docker inspect gs_db`
- `docker exec gs_db psql -U sentinel -d gsentinel_saas`
- `Invoke-WebRequest http://127.0.0.1:3000/api/health`
- `rg`

Containers relacionados:

| Container | Rol | Estado | Puerto |
|---|---|---|---|
| `gs_frontend` | Next.js Agenda canonica | running/healthy | `127.0.0.1:3000` |
| `gs_db` | PostgreSQL | running/healthy | interno `5432/tcp` |
| `gs_api` | FastAPI legacy externo | running/healthy | `127.0.0.1:8000` |

Compose activo:
- `E:\GSentinelHealthOS\docker-compose.yml`

Build context del frontend:
- `E:\GSentinelHealthOS\medical-agenda-saas`

DB real usada por Next:
- `gsentinel_saas`

Evidencia:
- `gs_frontend` tiene `DATABASE_URL` apuntando a `db:5432/gsentinel_saas`.
- `gs_frontend` usa imagen baked, sin bind mount de codigo.
- `gsentinel_saas` contiene `_prisma_migrations` y tablas Prisma de Agenda.

## Backend canonico confirmado

Agenda canonica usa:
- Next.js App Router.
- API Routes bajo `src/app/api`.
- Prisma Client.
- PostgreSQL `gsentinel_saas`.

Agenda **NO depende de `gs_api`/FastAPI legacy** como fuente de verdad.

El modelo correcto para profesionales en Agenda canonica es:
- `doctor_profiles`

No es:
- `doctors`

## Rutas reales Agenda

| Ruta | Backend | Estado sin auth | Estado autenticado LAB |
|---|---|---:|---:|
| `/api/doctors` | Next/Prisma | 401 | 200 |
| `/api/patients` | Next/Prisma | 401 | 200 |
| `/api/schedules` | Next/Prisma | 401 | 200 |
| `/api/appointments` GET | Next/Prisma | 401 | 200 |
| `/api/appointments` POST | Next/Prisma | 401 | 500 en runtime actual |
| `/api/appointments/suggestions` | Next/Prisma | 401 | 200 |
| `/api/webhooks/whatsapp` | Next/Prisma | firma HMAC | 200 con payload LAB firmado |

## Auth middleware

Validado:
- Login LAB con tenant `lab-test-tenant`: PASS.
- Cookie `Secure` en `NODE_ENV=production` sobre HTTP local no fue reenviada automaticamente por PowerShell.
- Smoke autenticado se ejecuto reenviando manualmente `Cookie` con `auth_token` y `tenant_id`, sin exponer token en reportes.

Riesgo:
- En LAB HTTP, `NODE_ENV=production` complica clientes de prueba por cookie `Secure`.

## Tenant isolation

Validacion:
- Login con `LAB_TEST_TENANT`.
- `GET /api/doctors` devolvio solo `LAB_TEST_DOCTOR`.

Resultado:
- PASS para aislamiento basico de doctores en smoke LAB.

Pendiente:
- Prueba multi-tenant completa con escritura cruzada negativa.

## Prisma schema vs DB

Tablas esperadas presentes en `gsentinel_saas`:
- `patients`
- `appointments`
- `doctor_profiles`
- `availability_rules`
- `agenda_settings`
- `clinic_whatsapp_accounts`
- `incoming_messages`
- `outgoing_messages`
- `conversation_states`
- `rate_limits`
- `failed_messages`

Conclusion:
- Prisma schema coincide con la DB canonica a nivel de tablas principales.

Bloqueo detectado:
- El codigo runtime baked contiene casts `::uuid` en queries raw contra columnas Prisma `TEXT`, provocando `operator does not exist: text = uuid` al crear turno.
- La fuente canonica fue corregida, pero el container activo no puede tomar ese cambio sin rebuild/deploy, prohibido en esta fase.

## Confirmaciones

- Agenda canonica NO depende de `gs_api`.
- `doctor_profiles` es correcto.
- `doctors` pertenece a confusion legacy, no a Agenda canonica.
- DB canonica de Agenda es `gsentinel_saas`.

