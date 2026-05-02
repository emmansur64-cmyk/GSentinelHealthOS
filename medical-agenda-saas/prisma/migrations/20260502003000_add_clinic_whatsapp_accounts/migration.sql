-- Safe migration for multi-tenant WhatsApp Embedded Signup.
-- No drops of data, no truncates. Keeps the existing global WhatsApp env fallback untouched.

CREATE TABLE IF NOT EXISTS "clinic_whatsapp_accounts" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "clinic_id" TEXT,
  "business_id" TEXT,
  "waba_id" TEXT,
  "phone_number_id" TEXT,
  "display_phone_number" TEXT,
  "access_token" TEXT,
  "token_type" TEXT,
  "expires_at" TIMESTAMP(3),
  "app_secret" TEXT,
  "verify_token" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "webhook_verified" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_webhook_at" TIMESTAMP(3),
  "last_error_at" TIMESTAMP(3),
  "last_error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinic_whatsapp_accounts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "clinic_whatsapp_accounts"
  ADD COLUMN IF NOT EXISTS "clinic_id" TEXT,
  ADD COLUMN IF NOT EXISTS "business_id" TEXT,
  ADD COLUMN IF NOT EXISTS "display_phone_number" TEXT,
  ADD COLUMN IF NOT EXISTS "token_type" TEXT,
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "app_secret" TEXT,
  ADD COLUMN IF NOT EXISTS "verify_token" TEXT,
  ADD COLUMN IF NOT EXISTS "webhook_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "last_webhook_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_error_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_error_message" TEXT,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "clinic_whatsapp_accounts"
  ALTER COLUMN "phone_number_id" DROP NOT NULL,
  ALTER COLUMN "waba_id" DROP NOT NULL,
  ALTER COLUMN "access_token" DROP NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'pending';

UPDATE "clinic_whatsapp_accounts"
SET "clinic_id" = COALESCE("clinic_id", "tenant_id"),
    "status" = CASE
      WHEN "status" IS NULL OR "status" = 'not_connected' THEN 'pending'
      WHEN "status" IN ('pending', 'connected', 'error', 'disconnected') THEN "status"
      ELSE 'error'
    END;

DROP INDEX IF EXISTS "clinic_whatsapp_accounts_phone_number_id_key";

CREATE INDEX IF NOT EXISTS "clinic_whatsapp_accounts_tenant_id_idx"
  ON "clinic_whatsapp_accounts"("tenant_id");

CREATE INDEX IF NOT EXISTS "clinic_whatsapp_accounts_clinic_id_idx"
  ON "clinic_whatsapp_accounts"("clinic_id");

CREATE INDEX IF NOT EXISTS "clinic_whatsapp_accounts_phone_number_id_idx"
  ON "clinic_whatsapp_accounts"("phone_number_id");

CREATE UNIQUE INDEX IF NOT EXISTS "clinic_whatsapp_accounts_tenant_id_phone_number_id_key"
  ON "clinic_whatsapp_accounts"("tenant_id", "phone_number_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinic_whatsapp_accounts_tenant_id_fkey'
  ) THEN
    ALTER TABLE "clinic_whatsapp_accounts"
      ADD CONSTRAINT "clinic_whatsapp_accounts_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
