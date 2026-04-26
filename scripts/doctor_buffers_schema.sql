-- Doctor asymmetric buffers over slot-based system
-- Constraints preserved:
-- 1) No new slots are created
-- 2) start_time/end_time are never modified
-- 3) Existing slot status machine is reused: available/booked/blocked

ALTER TABLE doctors
ADD COLUMN IF NOT EXISTS buffer_before_minutes INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS buffer_after_minutes INT NOT NULL DEFAULT 0;

ALTER TABLE doctors
ADD CONSTRAINT IF NOT EXISTS ck_doctors_buffer_before_non_negative
CHECK (buffer_before_minutes >= 0);

ALTER TABLE doctors
ADD CONSTRAINT IF NOT EXISTS ck_doctors_buffer_after_non_negative
CHECK (buffer_after_minutes >= 0);

-- Optional rollout compatibility: migrate legacy symmetric buffer (if table exists)
-- UPDATE doctors d
-- SET
--   buffer_before_minutes = c.buffer_minutes,
--   buffer_after_minutes = c.buffer_minutes
-- FROM doctor_schedule_config c
-- WHERE c.doctor_id = d.id
--   AND d.buffer_before_minutes = 0
--   AND d.buffer_after_minutes = 0;
