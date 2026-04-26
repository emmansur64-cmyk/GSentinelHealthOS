-- =============================================================================
-- Google Outbox Pattern schema (PostgreSQL-oriented SQL)
-- =============================================================================

CREATE TABLE IF NOT EXISTS google_outbox (
    id UUID PRIMARY KEY,
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    retries INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    last_error TEXT NULL,
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_google_outbox_action_valid CHECK (action IN ('create', 'update', 'delete')),
    CONSTRAINT ck_google_outbox_status_valid CHECK (status IN ('pending', 'processing', 'done', 'failed'))
);

CREATE INDEX IF NOT EXISTS ix_google_outbox_appointment_id ON google_outbox(appointment_id);
CREATE INDEX IF NOT EXISTS ix_google_outbox_action ON google_outbox(action);
CREATE INDEX IF NOT EXISTS ix_google_outbox_status ON google_outbox(status);
CREATE INDEX IF NOT EXISTS ix_google_outbox_next_attempt_at ON google_outbox(next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_google_outbox_status_next ON google_outbox(status, next_attempt_at);


-- =============================================================================
-- Worker claim query (concurrency-safe)
-- =============================================================================
-- BEGIN;
-- SELECT id, appointment_id, action, payload
-- FROM google_outbox
-- WHERE status = 'pending'
-- ORDER BY id
-- FOR UPDATE SKIP LOCKED
-- LIMIT 50;
-- UPDATE google_outbox
-- SET status = 'processing', updated_at = CURRENT_TIMESTAMP
-- WHERE id IN (...claimed ids...);
-- COMMIT;
