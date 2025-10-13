-- Fix duplicate attendance entries and improve data integrity

-- First, let's clean up existing duplicates
-- Keep only the most recent entry for each employee_id, log_time, log_type combination
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY employee_id, log_time, log_type 
      ORDER BY created_at DESC, id DESC
    ) as rn
  FROM attendance_logs
)
DELETE FROM attendance_logs 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Update the unique constraint to be more specific
-- Drop the existing unique index
DROP INDEX IF EXISTS ux_att_unique;

-- Create a new unique constraint that prevents duplicates more effectively
-- This will prevent the same employee from having multiple check-in/check-out records at the same time
CREATE UNIQUE INDEX ux_att_unique_improved
ON attendance_logs (employee_id, log_time, log_type);

-- Add a function to clean up future duplicates
CREATE OR REPLACE FUNCTION cleanup_attendance_duplicates()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete duplicate entries, keeping the most recent one
  WITH duplicates AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY employee_id, log_time, log_type 
        ORDER BY created_at DESC, id DESC
      ) as rn
    FROM attendance_logs
  )
  DELETE FROM attendance_logs 
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
END;
$$;

-- Create a function to get clean attendance data without duplicates
CREATE OR REPLACE FUNCTION get_clean_attendance_logs(
  p_employee_id TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  employee_id TEXT,
  employee_name TEXT,
  log_time TIMESTAMPTZ,
  log_type TEXT,
  device_id TEXT,
  source TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (al.employee_id, al.log_time, al.log_type)
    al.id,
    al.employee_id,
    al.employee_name,
    al.log_time,
    al.log_type,
    al.device_id,
    al.source,
    al.created_at
  FROM attendance_logs al
  WHERE (p_employee_id IS NULL OR al.employee_id = p_employee_id)
    AND (p_start_date IS NULL OR al.log_time::date >= p_start_date)
    AND (p_end_date IS NULL OR al.log_time::date <= p_end_date)
  ORDER BY al.employee_id, al.log_time, al.log_type, al.created_at DESC;
END;
$$;

-- Create a function to get attendance summary with check-in/check-out pairs
CREATE OR REPLACE FUNCTION get_attendance_pairs(
  p_employee_id TEXT DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  employee_id TEXT,
  employee_name TEXT,
  checkin_time TIMESTAMPTZ,
  checkout_time TIMESTAMPTZ,
  work_duration_minutes INTEGER,
  is_late BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH clean_logs AS (
    SELECT DISTINCT ON (al.employee_id, al.log_time, al.log_type)
      al.employee_id,
      al.employee_name,
      al.log_time,
      al.log_type,
      al.device_id,
      al.source
    FROM attendance_logs al
    WHERE (p_employee_id IS NULL OR al.employee_id = p_employee_id)
      AND al.log_time::date = p_date
    ORDER BY al.employee_id, al.log_time, al.log_type, al.created_at DESC
  ),
  checkin_checkout AS (
    SELECT 
      cl.employee_id,
      cl.employee_name,
      cl.log_time as checkin_time,
      LEAD(cl.log_time) OVER (
        PARTITION BY cl.employee_id, cl.log_time::date 
        ORDER BY cl.log_time
      ) as checkout_time,
      cl.device_id,
      cl.source
    FROM clean_logs cl
    WHERE cl.log_type = 'checkin'
  )
  SELECT 
    cc.employee_id,
    cc.employee_name,
    cc.checkin_time,
    cc.checkout_time,
    CASE 
      WHEN cc.checkout_time IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (cc.checkout_time - cc.checkin_time))::INTEGER / 60
      ELSE NULL
    END as work_duration_minutes,
    -- Simple late detection (after 10:45 AM)
    cc.checkin_time::time > '10:45:00'::time as is_late
  FROM checkin_checkout cc
  ORDER BY cc.employee_id, cc.checkin_time;
END;
$$;

-- Run cleanup on existing data
SELECT cleanup_attendance_duplicates();

