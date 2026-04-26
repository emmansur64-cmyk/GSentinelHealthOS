-- Add persisted per-user agenda settings.
-- Idempotent and compatible with legacy environments where users.id is TEXT.

CREATE TABLE IF NOT EXISTS "agenda_settings" (
  "user_id" TEXT NOT NULL,
  "appointment_duration" INTEGER NOT NULL,
  "buffer_minutes" INTEGER NOT NULL,
  "start_time" VARCHAR(5) NOT NULL,
  "end_time" VARCHAR(5) NOT NULL,
  "working_days" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "agenda_settings_pkey" PRIMARY KEY ("user_id")
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'agenda_settings'
      AND column_name = 'user_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE "agenda_settings"
      ALTER COLUMN "user_id" TYPE TEXT USING "user_id"::text;
  END IF;
END $$;

ALTER TABLE "agenda_settings"
  DROP CONSTRAINT IF EXISTS "agenda_settings_user_id_fkey";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agenda_settings_user_id_fkey'
  ) THEN
    ALTER TABLE "agenda_settings"
      ADD CONSTRAINT "agenda_settings_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
