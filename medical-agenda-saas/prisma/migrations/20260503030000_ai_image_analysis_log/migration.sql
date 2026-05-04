DO $$
BEGIN
  CREATE TYPE "AiImageAnalysisStatus" AS ENUM ('SUCCESS', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ai_image_analysis_logs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL DEFAULT 'default',
  "user_id" TEXT,
  "role" "Role",
  "source" TEXT NOT NULL,
  "image_mime_type" TEXT NOT NULL,
  "image_size_bytes" INTEGER NOT NULL,
  "image_type_detected" TEXT,
  "confidence" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "error_code" TEXT,
  "status" "AiImageAnalysisStatus" NOT NULL,

  CONSTRAINT "ai_image_analysis_logs_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "ai_image_analysis_logs"
    ADD CONSTRAINT "ai_image_analysis_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ai_image_analysis_logs"
    ADD CONSTRAINT "ai_image_analysis_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ai_image_analysis_logs_tenant_id_created_at_idx" ON "ai_image_analysis_logs"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_image_analysis_logs_tenant_id_user_id_created_at_idx" ON "ai_image_analysis_logs"("tenant_id", "user_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_image_analysis_logs_status_idx" ON "ai_image_analysis_logs"("status");
