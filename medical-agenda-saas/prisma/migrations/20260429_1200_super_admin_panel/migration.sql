-- Super Admin production control panel.
-- Extends the existing tenant model, where tenants are clinics.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'clinic_owner';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'clinic_admin';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'receptionist';

ALTER TYPE "TenantStatus" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "TenantStatus" ADD VALUE IF NOT EXISTS 'disabled';

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "legal_name" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "maintenance_mode" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'password',
  ADD COLUMN IF NOT EXISTS "provider_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "actor_user_id" TEXT,
  "action" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT,
  "clinic_id" TEXT,
  "metadata_json" JSONB,
  "ip_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_logs_actor_user_id_fkey'
  ) THEN
    ALTER TABLE "admin_audit_logs"
      ADD CONSTRAINT "admin_audit_logs_actor_user_id_fkey"
      FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_logs_clinic_id_fkey'
  ) THEN
    ALTER TABLE "admin_audit_logs"
      ADD CONSTRAINT "admin_audit_logs_clinic_id_fkey"
      FOREIGN KEY ("clinic_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "admin_audit_logs_clinic_id_created_at_idx"
  ON "admin_audit_logs"("clinic_id", "created_at");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_actor_user_id_created_at_idx"
  ON "admin_audit_logs"("actor_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_idx"
  ON "admin_audit_logs"("action");

CREATE TABLE IF NOT EXISTS "system_notifications" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "clinic_id" TEXT,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "channel" TEXT NOT NULL DEFAULT 'panel',
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  CONSTRAINT "system_notifications_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'system_notifications_clinic_id_fkey'
  ) THEN
    ALTER TABLE "system_notifications"
      ADD CONSTRAINT "system_notifications_clinic_id_fkey"
      FOREIGN KEY ("clinic_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'system_notifications_created_by_fkey'
  ) THEN
    ALTER TABLE "system_notifications"
      ADD CONSTRAINT "system_notifications_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "system_notifications_clinic_id_created_at_idx"
  ON "system_notifications"("clinic_id", "created_at");
CREATE INDEX IF NOT EXISTS "system_notifications_status_created_at_idx"
  ON "system_notifications"("status", "created_at");

ALTER TABLE IF EXISTS "client_whatsapp_accounts"
  ADD COLUMN IF NOT EXISTS "last_webhook_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_error_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_error_message" TEXT;
