# Multi-tenant Paso 2

Fecha: 2026-04-27

## Alcance

Este paso agrega la base de identidad multi-tenant sin modificar endpoints ni consultas clinicas.

## Backend Python/FastAPI

Se agregan modelos SQLAlchemy:

- `Clinic`: tabla `clinics`.
- `ClinicMember`: tabla `clinic_members`.
- `ClinicMemberRole`: roles `SUPER_ADMIN`, `CLINIC_ADMIN`, `SECRETARY`, `DOCTOR`.

Se agregan campos compatibles al modelo existente `User`:

- `email`
- `name`
- `auth_provider`
- `active`
- `created_at`
- `updated_at`

No se eliminan campos legacy:

- `username`
- `hashed_password`
- `role`
- `is_active`
- `doctor_id`

Migracion Alembic:

- `alembic/versions/20260427_0019_multi_tenant_identity.py`

## Next.js/Prisma

No se crea una tabla `clinics` nueva porque el schema ya usa `Tenant` como entidad equivalente a clinica.

Se agrega:

- enum `ClinicMemberRole`
- modelo `ClinicMember`, mapeado a tabla `clinic_members`
- relacion `User.clinicMemberships`
- relacion `Tenant.clinicMembers`
- campos `User.auth_provider` y `User.active`

Migracion Prisma:

- `medical-agenda-saas/prisma/migrations/20260427000100_clinic_members_identity/migration.sql`

## Pendiente

Este paso no resuelve todavia:

- middleware de clinica activa
- validacion de pertenencia por endpoint
- filtrado obligatorio por `clinic_id`/`tenant_id`
- aprobacion de usuarios
- seleccion de clinica activa
- separacion de WhatsApp por clinica
