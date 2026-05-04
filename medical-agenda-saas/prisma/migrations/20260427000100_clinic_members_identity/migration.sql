-- Multi-clinic user membership foundation.
-- Existing Tenant is the clinic-equivalent table in this Prisma app; do not create a duplicate clinics table.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClinicMemberRole') THEN
    CREATE TYPE "ClinicMemberRole" AS ENUM ('SUPER_ADMIN', 'CLINIC_ADMIN', 'SECRETARY', 'DOCTOR');
  END IF;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" TEXT NOT NULL DEFAULT 'password';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "clinic_members" (
  "id" TEXT PRIMARY KEY,
  "clinic_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "ClinicMemberRole" NOT NULL,
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "clinic_members_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinic_members_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "clinic_members_clinic_id_user_id_key"
  ON "clinic_members" ("clinic_id", "user_id");

CREATE INDEX IF NOT EXISTS "clinic_members_clinic_id_role_approved_idx"
  ON "clinic_members" ("clinic_id", "role", "approved");

CREATE INDEX IF NOT EXISTS "clinic_members_user_id_approved_idx"
  ON "clinic_members" ("user_id", "approved");
