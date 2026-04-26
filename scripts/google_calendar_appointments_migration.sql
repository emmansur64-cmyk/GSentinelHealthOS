-- =============================================================================
-- Google Calendar fields for appointments
-- =============================================================================
-- Recommended PostgreSQL migration SQL

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS google_event_id TEXT;

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS google_sync_status VARCHAR(20) NOT NULL DEFAULT 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS ix_appointments_google_event_id
ON appointments (google_event_id)
WHERE google_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_appointments_google_sync_status
ON appointments (google_sync_status);

-- Optional hardening for PostgreSQL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_appointments_google_sync_status_valid'
    ) THEN
        ALTER TABLE appointments
        ADD CONSTRAINT ck_appointments_google_sync_status_valid
        CHECK (google_sync_status IN ('pending', 'synced', 'failed'));
    END IF;
END $$;
