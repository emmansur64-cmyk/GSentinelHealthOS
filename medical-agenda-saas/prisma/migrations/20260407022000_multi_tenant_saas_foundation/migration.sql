-- Multi-tenant SaaS foundation migration.
-- Idempotent migration compatible with legacy databases.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TenantPlan') THEN
    CREATE TYPE "TenantPlan" AS ENUM ('basico', 'profesional', 'enterprise');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TenantStatus') THEN
    CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'trial');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('admin', 'recepcionista', 'medico', 'secretaria', 'doctor');
  ELSE
    BEGIN
      ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'recepcionista';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;

    BEGIN
      ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'medico';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tenants" (
  "id" TEXT PRIMARY KEY,
  "nombre" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "plan" "TenantPlan" NOT NULL DEFAULT 'basico',
  "estado" "TenantStatus" NOT NULL DEFAULT 'active',
  "limite_medicos" INTEGER NOT NULL DEFAULT 5,
  "limite_turnos_mensuales" INTEGER NOT NULL DEFAULT 1500,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO "tenants" ("id", "nombre", "slug", "plan", "estado", "limite_medicos", "limite_turnos_mensuales")
VALUES ('default', 'Clinica Principal', 'clinica-principal', 'profesional', 'active', 20, 5000)
ON CONFLICT ("id") DO NOTHING;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users',
    'doctor_profiles',
    'agenda_settings',
    'patients',
    'appointments',
    'availability_rules',
    'sessions',
    'activity_logs',
    'audit_logs',
    'incoming_messages',
    'outgoing_messages',
    'conversation_states',
    'rate_limits',
    'failed_messages'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id TEXT', tbl);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET DEFAULT %L', tbl, 'default');
    EXECUTE format('UPDATE %I SET tenant_id = COALESCE(tenant_id, %L)', tbl, 'default');
    EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', tbl);
  END LOOP;
END $$;

-- Legacy compatibility: some schemas use patients.phone without patients.document.
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "document" TEXT;

-- Tenant constraints
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_tenant_id_fkey";
ALTER TABLE "users"
  ADD CONSTRAINT "users_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "doctor_profiles" DROP CONSTRAINT IF EXISTS "doctor_profiles_tenant_id_fkey";
ALTER TABLE "doctor_profiles"
  ADD CONSTRAINT "doctor_profiles_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agenda_settings" DROP CONSTRAINT IF EXISTS "agenda_settings_tenant_id_fkey";
ALTER TABLE "agenda_settings"
  ADD CONSTRAINT "agenda_settings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_tenant_id_fkey";
ALTER TABLE "patients"
  ADD CONSTRAINT "patients_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_tenant_id_fkey";
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "availability_rules" DROP CONSTRAINT IF EXISTS "availability_rules_tenant_id_fkey";
ALTER TABLE "availability_rules"
  ADD CONSTRAINT "availability_rules_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_tenant_id_fkey";
ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_tenant_id_fkey";
ALTER TABLE "activity_logs"
  ADD CONSTRAINT "activity_logs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_tenant_id_fkey";
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "incoming_messages" DROP CONSTRAINT IF EXISTS "incoming_messages_tenant_id_fkey";
ALTER TABLE "incoming_messages"
  ADD CONSTRAINT "incoming_messages_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "outgoing_messages" DROP CONSTRAINT IF EXISTS "outgoing_messages_tenant_id_fkey";
ALTER TABLE "outgoing_messages"
  ADD CONSTRAINT "outgoing_messages_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversation_states" DROP CONSTRAINT IF EXISTS "conversation_states_tenant_id_fkey";
ALTER TABLE "conversation_states"
  ADD CONSTRAINT "conversation_states_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rate_limits" DROP CONSTRAINT IF EXISTS "rate_limits_tenant_id_fkey";
ALTER TABLE "rate_limits"
  ADD CONSTRAINT "rate_limits_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "failed_messages" DROP CONSTRAINT IF EXISTS "failed_messages_tenant_id_fkey";
ALTER TABLE "failed_messages"
  ADD CONSTRAINT "failed_messages_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Multi-tenant uniqueness constraints
DROP INDEX IF EXISTS "users_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenant_id_email_key" ON "users" ("tenant_id", "email");

DROP INDEX IF EXISTS "doctor_profiles_matricula_key";
CREATE UNIQUE INDEX IF NOT EXISTS "doctor_profiles_tenant_id_matricula_key" ON "doctor_profiles" ("tenant_id", "matricula");

DROP INDEX IF EXISTS "doctor_profiles_ai_tag_key";
CREATE UNIQUE INDEX IF NOT EXISTS "doctor_profiles_tenant_id_ai_tag_key" ON "doctor_profiles" ("tenant_id", "ai_tag");

DROP INDEX IF EXISTS "patients_document_key";
CREATE UNIQUE INDEX IF NOT EXISTS "patients_tenant_id_document_key" ON "patients" ("tenant_id", "document") WHERE "document" IS NOT NULL;

DROP INDEX IF EXISTS "appointments_idempotency_key_key";
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_tenant_id_idempotency_key_key"
  ON "appointments" ("tenant_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

-- Tenant-aware indexes
CREATE INDEX IF NOT EXISTS "users_tenant_id_role_idx" ON "users" ("tenant_id", "role");
CREATE INDEX IF NOT EXISTS "doctor_profiles_tenant_id_specialty_idx" ON "doctor_profiles" ("tenant_id", "specialty");
CREATE INDEX IF NOT EXISTS "patients_tenant_id_created_at_idx" ON "patients" ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "appointments_tenant_doctor_datetime_idx" ON "appointments" ("tenant_id", "doctor_id", "datetime");
CREATE INDEX IF NOT EXISTS "appointments_tenant_status_datetime_idx" ON "appointments" ("tenant_id", "doctor_id", "status", "datetime");
CREATE INDEX IF NOT EXISTS "availability_rules_tenant_doctor_day_idx" ON "availability_rules" ("tenant_id", "doctor_id", "day_of_week");
CREATE INDEX IF NOT EXISTS "sessions_tenant_user_idx" ON "sessions" ("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "activity_logs_tenant_created_at_idx" ON "activity_logs" ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_created_at_idx" ON "audit_logs" ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "incoming_messages_tenant_phone_idx" ON "incoming_messages" ("tenant_id", "from_phone");
CREATE INDEX IF NOT EXISTS "outgoing_messages_tenant_phone_idx" ON "outgoing_messages" ("tenant_id", "phone");
CREATE INDEX IF NOT EXISTS "failed_messages_tenant_status_idx" ON "failed_messages" ("tenant_id", "status");

-- Basic row level security setup for tenant isolation.
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users',
    'doctor_profiles',
    'agenda_settings',
    'patients',
    'appointments',
    'availability_rules',
    'sessions',
    'activity_logs',
    'audit_logs',
    'incoming_messages',
    'outgoing_messages',
    'conversation_states',
    'rate_limits',
    'failed_messages'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_tenant_isolation', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = current_setting(''app.current_tenant'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant'', true))',
      tbl || '_tenant_isolation',
      tbl
    );
  END LOOP;
END $$;
