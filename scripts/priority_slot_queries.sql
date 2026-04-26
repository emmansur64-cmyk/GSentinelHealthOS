-- Priority Scheduling Queries (normal | urgent)
-- Designed for PostgreSQL

-- ---------------------------------------------------------------------------
-- 1) First best slot for NORMAL priority (only available)
-- ---------------------------------------------------------------------------
-- Params: :doctor_id, :start_ts, :end_ts
SELECT ts.id AS slot_id, 'available'::text AS source
FROM time_slots ts
WHERE ts.doctor_id = :doctor_id
  AND ts.start_time >= :start_ts
  AND ts.start_time < :end_ts
  AND ts.status = 'available'
ORDER BY ts.start_time ASC
LIMIT 1;


-- ---------------------------------------------------------------------------
-- 2) First best slot for URGENT priority (available first)
-- ---------------------------------------------------------------------------
SELECT ts.id AS slot_id, 'available'::text AS source
FROM time_slots ts
WHERE ts.doctor_id = :doctor_id
  AND ts.start_time >= :start_ts
  AND ts.start_time < :end_ts
  AND ts.status = 'available'
ORDER BY ts.start_time ASC
LIMIT 1;


-- ---------------------------------------------------------------------------
-- 3) Fallback for URGENT: take blocked slot
-- ---------------------------------------------------------------------------
SELECT ts.id AS slot_id, 'blocked'::text AS source
FROM time_slots ts
WHERE ts.doctor_id = :doctor_id
  AND ts.start_time >= :start_ts
  AND ts.start_time < :end_ts
  AND ts.status = 'blocked'
ORDER BY ts.start_time ASC
LIMIT 1;


-- ---------------------------------------------------------------------------
-- 4) Optional fallback for URGENT: reassign future normal appointment
-- ---------------------------------------------------------------------------
-- Candidate to displace (booked + normal + scheduled)
SELECT ts.id AS slot_id, a.id AS appointment_id, 'reassign'::text AS source
FROM time_slots ts
JOIN appointments a ON a.slot_id = ts.id
WHERE ts.doctor_id = :doctor_id
  AND ts.start_time >= :start_ts
  AND ts.start_time < :end_ts
  AND ts.status = 'booked'
  AND a.priority = 'normal'
  AND a.status = 'scheduled'
ORDER BY ts.start_time ASC
LIMIT 1;

-- Replacement slot for displaced appointment
SELECT ts.id AS replacement_slot_id
FROM time_slots ts
WHERE ts.doctor_id = :doctor_id
  AND ts.start_time > :displaced_slot_start
  AND ts.status = 'available'
ORDER BY ts.start_time ASC
LIMIT 1;


-- ---------------------------------------------------------------------------
-- 5) Single query chooser for URGENT (available -> blocked -> reassign)
-- ---------------------------------------------------------------------------
WITH available_candidate AS (
    SELECT ts.id AS slot_id, 'available'::text AS source, ts.start_time
    FROM time_slots ts
    WHERE ts.doctor_id = :doctor_id
      AND ts.start_time >= :start_ts
      AND ts.start_time < :end_ts
      AND ts.status = 'available'
    ORDER BY ts.start_time ASC
    LIMIT 1
),
blocked_candidate AS (
    SELECT ts.id AS slot_id, 'blocked'::text AS source, ts.start_time
    FROM time_slots ts
    WHERE ts.doctor_id = :doctor_id
      AND ts.start_time >= :start_ts
      AND ts.start_time < :end_ts
      AND ts.status = 'blocked'
    ORDER BY ts.start_time ASC
    LIMIT 1
),
reassign_candidate AS (
    SELECT ts.id AS slot_id, 'reassign'::text AS source, ts.start_time
    FROM time_slots ts
    JOIN appointments a ON a.slot_id = ts.id
    WHERE ts.doctor_id = :doctor_id
      AND ts.start_time >= :start_ts
      AND ts.start_time < :end_ts
      AND ts.status = 'booked'
      AND a.priority = 'normal'
      AND a.status = 'scheduled'
    ORDER BY ts.start_time ASC
    LIMIT 1
)
SELECT slot_id, source
FROM (
    SELECT * FROM available_candidate
    UNION ALL
    SELECT * FROM blocked_candidate
    WHERE NOT EXISTS (SELECT 1 FROM available_candidate)
    UNION ALL
    SELECT * FROM reassign_candidate
    WHERE :allow_reassign = TRUE
      AND NOT EXISTS (SELECT 1 FROM available_candidate)
      AND NOT EXISTS (SELECT 1 FROM blocked_candidate)
) ranked
ORDER BY start_time ASC
LIMIT 1;


-- ---------------------------------------------------------------------------
-- 6) Audit query: who displaced whom
-- ---------------------------------------------------------------------------
SELECT
    ara.id,
    ara.doctor_id,
    ara.displaced_appointment_id,
    ara.urgent_appointment_id,
    ara.old_slot_id,
    ara.new_slot_id,
    ara.displaced_by_user_id,
    ara.reason,
    ara.created_at
FROM appointment_reassignment_audit ara
WHERE ara.doctor_id = :doctor_id
ORDER BY ara.created_at DESC
LIMIT :limit;


-- ---------------------------------------------------------------------------
-- 7) Specialty policy for urgent reassignment
-- ---------------------------------------------------------------------------
-- Params: :doctor_id
SELECT
  d.id AS doctor_id,
  d.specialization AS specialty,
  COALESCE(spp.allow_urgent_reassign, FALSE) AS allow_urgent_reassign,
  COALESCE(spp.urgent_sla_target_minutes, 60) AS urgent_sla_target_minutes
FROM doctors d
LEFT JOIN specialty_priority_policy spp
     ON spp.specialty = d.specialization
WHERE d.id = :doctor_id;


-- ---------------------------------------------------------------------------
-- 8) Urgent SLA metrics by doctor (window)
-- ---------------------------------------------------------------------------
-- Params: :doctor_id, :from_dt
WITH urgent_bookings AS (
  SELECT COUNT(a.id) AS urgent_total
  FROM appointments a
  JOIN time_slots ts ON ts.id = a.slot_id
  WHERE ts.doctor_id = :doctor_id
    AND a.priority = 'urgent'
    AND a.created_at >= :from_dt
),
displacements AS (
  SELECT
    COUNT(ara.id) AS displaced_total,
    AVG(ara.urgent_wait_minutes) AS avg_urgent_wait_minutes
  FROM appointment_reassignment_audit ara
  WHERE ara.doctor_id = :doctor_id
    AND ara.created_at >= :from_dt
)
SELECT
  ub.urgent_total,
  d.displaced_total,
  CASE WHEN ub.urgent_total > 0
     THEN ROUND((d.displaced_total::numeric / ub.urgent_total::numeric) * 100, 2)
     ELSE 0
  END AS displacement_rate_percent,
  d.avg_urgent_wait_minutes
FROM urgent_bookings ub, displacements d;
