CREATE TABLE IF NOT EXISTS "clinic_whatsapp_accounts" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "phone_number_id" TEXT NOT NULL,
  "waba_id" TEXT NOT NULL,
  "access_token" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "clinic_whatsapp_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "clinic_whatsapp_accounts_phone_number_id_key"
  ON "clinic_whatsapp_accounts"("phone_number_id");

CREATE INDEX IF NOT EXISTS "clinic_whatsapp_accounts_tenant_id_is_active_idx"
  ON "clinic_whatsapp_accounts"("tenant_id", "is_active");

CREATE INDEX IF NOT EXISTS "clinic_whatsapp_accounts_waba_id_idx"
  ON "clinic_whatsapp_accounts"("waba_id");

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
