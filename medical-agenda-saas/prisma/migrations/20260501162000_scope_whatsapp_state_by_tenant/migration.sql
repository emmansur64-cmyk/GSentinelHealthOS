-- Scope WhatsApp conversation state and rate limits by tenant.
-- Existing single-tenant rows keep their current tenant_id/default value.

ALTER TABLE "conversation_states" DROP CONSTRAINT IF EXISTS "conversation_states_pkey";
ALTER TABLE "conversation_states" ADD CONSTRAINT "conversation_states_pkey" PRIMARY KEY ("tenant_id", "phone");
CREATE INDEX IF NOT EXISTS "conversation_states_phone_idx" ON "conversation_states"("phone");

ALTER TABLE "rate_limits" DROP CONSTRAINT IF EXISTS "rate_limits_pkey";
ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("tenant_id", "phone");
CREATE INDEX IF NOT EXISTS "rate_limits_phone_idx" ON "rate_limits"("phone");
