-- =============================================================================
-- Multi-resource booking validation queries
-- =============================================================================
-- Goal:
-- A booking is valid only if ALL required resources are available
-- for the same slot window.

-- -----------------------------------------------------------------------------
-- 1) Check required resources for a slot
-- Params: :slot_id
-- -----------------------------------------------------------------------------
SELECT
  srr.slot_id,
  r.id AS resource_id,
  r.type,
  r.name,
  r.external_ref
FROM slot_resource_requirements srr
JOIN resources r ON r.id = srr.resource_id
WHERE srr.slot_id = :slot_id
ORDER BY r.type, r.id;


-- -----------------------------------------------------------------------------
-- 2) Validate that all required resources are available for the slot
-- Params: :slot_id, :slot_start, :slot_end
-- -----------------------------------------------------------------------------
WITH req AS (
  SELECT resource_id
  FROM slot_resource_requirements
  WHERE slot_id = :slot_id
),
avail AS (
  SELECT rs.resource_id
  FROM resource_slots rs
  JOIN req ON req.resource_id = rs.resource_id
  WHERE rs.start_time = :slot_start
    AND rs.end_time = :slot_end
    AND rs.status = 'available'
)
SELECT
  (SELECT COUNT(*) FROM req) AS required_count,
  (SELECT COUNT(*) FROM avail) AS available_count,
  ((SELECT COUNT(*) FROM req) = (SELECT COUNT(*) FROM avail)) AS all_available;


-- -----------------------------------------------------------------------------
-- 3) Atomic multi-resource lock for booking
-- Params: :slot_id, :slot_start, :slot_end
-- -----------------------------------------------------------------------------
WITH req AS (
  SELECT resource_id
  FROM slot_resource_requirements
  WHERE slot_id = :slot_id
),
upd AS (
  UPDATE resource_slots rs
  SET status = 'booked'
  FROM req
  WHERE rs.resource_id = req.resource_id
    AND rs.start_time = :slot_start
    AND rs.end_time = :slot_end
    AND rs.status = 'available'
  RETURNING rs.resource_id
)
SELECT
  (SELECT COUNT(*) FROM req) AS required_count,
  (SELECT COUNT(*) FROM upd) AS booked_count,
  ((SELECT COUNT(*) FROM req) = (SELECT COUNT(*) FROM upd)) AS lock_success;


-- -----------------------------------------------------------------------------
-- 4) Example requested: doctor_id=1 + room=3 must both be free
-- Assumption: resources table has
--   - doctor mapped as (type='doctor', external_ref='1')
--   - room mapped as (type='room', external_ref='3')
-- Params: :slot_start, :slot_end
-- -----------------------------------------------------------------------------
WITH required AS (
  SELECT id AS resource_id
  FROM resources
  WHERE (type = 'doctor' AND external_ref = '1')
     OR (type = 'room' AND external_ref = '3')
),
avail AS (
  SELECT rs.resource_id
  FROM resource_slots rs
  JOIN required rq ON rq.resource_id = rs.resource_id
  WHERE rs.start_time = :slot_start
    AND rs.end_time = :slot_end
    AND rs.status = 'available'
)
SELECT
  (SELECT COUNT(*) FROM required) AS required_count,
  (SELECT COUNT(*) FROM avail) AS available_count,
  ((SELECT COUNT(*) FROM required) = (SELECT COUNT(*) FROM avail)) AS can_book;
