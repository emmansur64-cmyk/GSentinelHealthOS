-- Migration: extend clinic_whatsapp_accounts with missing operational columns
-- Safe: all changes are ADD COLUMN with defaults or nullable. No drops, no truncates.

ALTER TABLE "clinic_whatsapp_accounts"
  ADD COLUMN IF NOT EXISTS "display_phone_number" TEXT,
  ADD COLUMN IF NOT EXISTS "app_secret"           TEXT,
  ADD COLUMN IF NOT EXISTS "verify_token"         TEXT,
  ADD COLUMN IF NOT EXISTS "status"               TEXT NOT NULL DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS "last_webhook_at"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_error_at"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_error_message"   TEXT,
  ADD COLUMN IF NOT EXISTS "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: marcar las cuentas activas como "connected"
UPDATE "clinic_whatsapp_accounts"
SET "status" = 'connected'
WHERE "is_active" = true
  AND "access_token" IS NOT NULL
  AND "access_token" <> '';

-- Índice de estado para queries de dashboard
CREATE INDEX IF NOT EXISTS "clinic_whatsapp_accounts_status_idx"
  ON "clinic_whatsapp_accounts" ("status");
