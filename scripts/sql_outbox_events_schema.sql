-- Outbox + idempotency tables for event-driven booking architecture
-- PostgreSQL

BEGIN;

CREATE TABLE IF NOT EXISTS outbox_events (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    routing_key VARCHAR(150) NOT NULL,
    aggregate_type VARCHAR(80) NOT NULL,
    aggregate_id VARCHAR(120) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|published|dead
    attempts INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 8,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ NULL,
    last_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status IN ('pending', 'published', 'dead')),
    CHECK (attempts >= 0),
    CHECK (max_retries >= 1)
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending_scan
ON outbox_events (status, next_attempt_at, created_at)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_outbox_aggregate
ON outbox_events (aggregate_type, aggregate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outbox_event_type
ON outbox_events (event_type, created_at DESC);

-- Idempotency per consumer
CREATE TABLE IF NOT EXISTS processed_events (
    id BIGSERIAL PRIMARY KEY,
    consumer_name VARCHAR(120) NOT NULL,
    event_id UUID NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (consumer_name, event_id)
);

CREATE INDEX IF NOT EXISTS idx_processed_events_lookup
ON processed_events (consumer_name, processed_at DESC);

-- Optional trigger for updated_at
CREATE OR REPLACE FUNCTION set_outbox_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outbox_updated_at ON outbox_events;
CREATE TRIGGER trg_outbox_updated_at
BEFORE UPDATE ON outbox_events
FOR EACH ROW
EXECUTE FUNCTION set_outbox_updated_at();

COMMIT;

-- Example enqueue usage inside booking transaction:
-- INSERT INTO outbox_events (event_id, event_type, routing_key, aggregate_type, aggregate_id, payload)
-- VALUES (
--   gen_random_uuid(),
--   'AppointmentCreated',
--   'appointment.created',
--   'appointment',
--   'appointment:987',
--   jsonb_build_object(
--     'event_id', gen_random_uuid(),
--     'event_type', 'AppointmentCreated',
--     'occurred_at', now(),
--     'aggregate_type', 'appointment',
--     'aggregate_id', 'appointment:987',
--     'correlation_id', '...',
--     'causation_id', '...',
--     'data', jsonb_build_object(
--       'appointment_id', 987,
--       'slot_id', 123,
--       'doctor_id', 1,
--       'patient_id', 1001,
--       'status', 'scheduled'
--     ),
--     'metadata', jsonb_build_object('schema_version', 1, 'producer', 'booking-service')
--   )
-- );
