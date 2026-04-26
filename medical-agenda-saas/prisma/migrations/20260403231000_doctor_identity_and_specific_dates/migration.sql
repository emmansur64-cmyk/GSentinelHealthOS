-- Add real doctor identifiers required for manual operational management
ALTER TABLE "doctor_profiles"
  ADD COLUMN "matricula" TEXT,
  ADD COLUMN "ai_tag" TEXT;

-- Backfill existing rows with deterministic placeholders only for legacy records
UPDATE "doctor_profiles"
SET
  "matricula" = COALESCE("matricula", CONCAT('MAT-', UPPER(SUBSTRING(REPLACE("user_id", '-', ''), 1, 10)))),
  "ai_tag" = COALESCE("ai_tag", CONCAT('DOC_', LOWER(SUBSTRING(REPLACE("user_id", '-', ''), 1, 12))));

ALTER TABLE "doctor_profiles"
  ALTER COLUMN "matricula" SET NOT NULL,
  ALTER COLUMN "ai_tag" SET NOT NULL;

CREATE UNIQUE INDEX "doctor_profiles_matricula_key" ON "doctor_profiles"("matricula");
CREATE UNIQUE INDEX "doctor_profiles_ai_tag_key" ON "doctor_profiles"("ai_tag");

-- Optional specific date support for one-off availability configuration
ALTER TABLE "availability_rules"
  ADD COLUMN "specific_date" TIMESTAMP(3);
