ALTER TABLE "clinic_whatsapp_accounts"
  ADD COLUMN IF NOT EXISTS "refresh_token" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsapp_phone_number" TEXT,
  ADD COLUMN IF NOT EXISTS "webhook_verify_token_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "last_authorized_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_verified_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "platform_oauth_states" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "state_hash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_oauth_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_oauth_states_state_hash_key" ON "platform_oauth_states"("state_hash");
CREATE INDEX IF NOT EXISTS "platform_oauth_states_tenant_id_user_id_purpose_idx" ON "platform_oauth_states"("tenant_id", "user_id", "purpose");
CREATE INDEX IF NOT EXISTS "platform_oauth_states_expires_at_idx" ON "platform_oauth_states"("expires_at");
