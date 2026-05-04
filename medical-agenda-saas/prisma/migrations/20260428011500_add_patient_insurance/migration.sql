-- Add optional patient insurance coverage for manual secretary intake.
-- Safe for production: nullable column, no data deletion.

ALTER TABLE "patients"
  ADD COLUMN IF NOT EXISTS "insurance" TEXT;
