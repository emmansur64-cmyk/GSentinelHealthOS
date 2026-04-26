-- =============================================================================
-- Reconciliation diagnostic queries (PostgreSQL)
-- =============================================================================

-- Params:
-- :hours_window (e.g. 24, 48, 72)

-- 1) Scheduled appointments with missing google_event_id
SELECT
  a.id AS appointment_id,
  a.doctor_id,
  a.patient_id,
  a.date_time,
  a.status,
  a.google_event_id,
  a.google_sync_status,
  a.updated_at
FROM appointments a
WHERE a.status = 'scheduled'
  AND a.google_event_id IS NULL
  AND a.updated_at >= (NOW() - (:hours_window || ' hours')::interval)
ORDER BY a.updated_at DESC;

-- 2) Cancelled appointments that still keep a google_event_id reference
SELECT
  a.id AS appointment_id,
  a.google_event_id,
  a.google_sync_status,
  a.updated_at
FROM appointments a
WHERE a.status = 'cancelled'
  AND a.google_event_id IS NOT NULL
  AND a.updated_at >= (NOW() - (:hours_window || ' hours')::interval)
ORDER BY a.updated_at DESC;

-- 3) Reconciliation counters over recent window
SELECT
  COUNT(*) FILTER (
    WHERE a.status = 'scheduled' AND a.google_event_id IS NULL
  ) AS scheduled_missing_google_event_id,
  COUNT(*) FILTER (
    WHERE a.status = 'cancelled' AND a.google_event_id IS NOT NULL
  ) AS cancelled_with_stale_google_event_id,
  COUNT(*) FILTER (
    WHERE a.google_sync_status = 'failed'
  ) AS failed_sync_status
FROM appointments a
WHERE a.updated_at >= (NOW() - (:hours_window || ' hours')::interval);
