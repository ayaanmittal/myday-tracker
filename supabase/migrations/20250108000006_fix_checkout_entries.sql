-- Fix incorrect check-out entries that were marked as check-ins

-- First, let's identify and fix the incorrect entries
-- The issue is that some check-out times were incorrectly inserted as check-in entries

-- Create a function to identify and fix incorrect log types
CREATE OR REPLACE FUNCTION fix_incorrect_log_types()
RETURNS TABLE (
  fixed_count INTEGER,
  details TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_fixed_count INTEGER := 0;
  v_details TEXT := '';
BEGIN
  -- Find entries where check-out time was incorrectly marked as check-in
  -- These are typically entries where the time is later in the day and there's already a check-in for the same employee on the same date
  WITH incorrect_entries AS (
    SELECT 
      al1.id,
      al1.employee_id,
      al1.log_time,
      al1.log_type,
      al1.raw_payload
    FROM attendance_logs al1
    WHERE al1.log_type = 'checkin'
      AND al1.log_time::time > '12:00:00'::time  -- Check-ins after noon are suspicious
      AND EXISTS (
        SELECT 1 
        FROM attendance_logs al2 
        WHERE al2.employee_id = al1.employee_id 
          AND al2.log_time::date = al1.log_time::date
          AND al2.log_type = 'checkin'
          AND al2.log_time::time < al1.log_time::time  -- There's an earlier check-in
          AND al2.id != al1.id
      )
  ),
  -- Also find entries where the raw payload suggests it should be a checkout
  checkout_candidates AS (
    SELECT 
      al.id,
      al.employee_id,
      al.log_time,
      al.raw_payload
    FROM attendance_logs al
    WHERE al.log_type = 'checkin'
      AND al.raw_payload ? 'OUTTime'
      AND al.raw_payload->>'OUTTime' IS NOT NULL
      AND al.raw_payload->>'OUTTime' != ''
      AND al.raw_payload->>'OUTTime' != al.raw_payload->>'INTime'
  )
  -- Update incorrect entries to be checkouts
  UPDATE attendance_logs 
  SET log_type = 'checkout'
  WHERE id IN (
    SELECT id FROM incorrect_entries
    UNION
    SELECT id FROM checkout_candidates
  );
  
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  v_details := 'Fixed ' || v_fixed_count || ' incorrect log types';
  
  RETURN QUERY SELECT v_fixed_count, v_details;
END;
$$;

-- Create a function to clean up duplicate entries more intelligently
CREATE OR REPLACE FUNCTION smart_cleanup_duplicates()
RETURNS TABLE (
  removed_count INTEGER,
  details TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_removed_count INTEGER := 0;
  v_details TEXT := '';
BEGIN
  -- Remove duplicates, keeping the most logical entry
  -- Priority: 1) Entries with device_id 'teamoffice' 2) Most recent entry
  WITH ranked_entries AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY employee_id, log_time, log_type 
        ORDER BY 
          CASE WHEN device_id = 'teamoffice' THEN 1 ELSE 2 END,
          created_at DESC
      ) as rn
    FROM attendance_logs
  )
  DELETE FROM attendance_logs 
  WHERE id IN (
    SELECT id FROM ranked_entries WHERE rn > 1
  );
  
  GET DIAGNOSTICS v_removed_count = ROW_COUNT;
  v_details := 'Removed ' || v_removed_count || ' duplicate entries';
  
  RETURN QUERY SELECT v_removed_count, v_details;
END;
$$;

-- Create a function to get proper attendance pairs
CREATE OR REPLACE FUNCTION get_proper_attendance_pairs(
  p_employee_id TEXT DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  employee_id TEXT,
  employee_name TEXT,
  checkin_time TIMESTAMPTZ,
  checkout_time TIMESTAMPTZ,
  work_duration_minutes INTEGER,
  is_late BOOLEAN,
  device_info TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH clean_logs AS (
    -- Get unique entries per employee, time, and type
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
    ORDER BY al.employee_id, al.log_time, al.log_type, 
      CASE WHEN al.device_id = 'teamoffice' THEN 1 ELSE 2 END,
      al.created_at DESC
  ),
  checkins AS (
    SELECT 
      cl.employee_id,
      cl.employee_name,
      cl.log_time,
      cl.device_id,
      ROW_NUMBER() OVER (PARTITION BY cl.employee_id ORDER BY cl.log_time) as rn
    FROM clean_logs cl
    WHERE cl.log_type = 'checkin'
  ),
  checkouts AS (
    SELECT 
      cl.employee_id,
      cl.employee_name,
      cl.log_time,
      cl.device_id,
      ROW_NUMBER() OVER (PARTITION BY cl.employee_id ORDER BY cl.log_time) as rn
    FROM clean_logs cl
    WHERE cl.log_type = 'checkout'
  )
  SELECT 
    ci.employee_id,
    ci.employee_name,
    ci.log_time as checkin_time,
    co.log_time as checkout_time,
    CASE 
      WHEN co.log_time IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (co.log_time - ci.log_time))::INTEGER / 60
      ELSE NULL
    END as work_duration_minutes,
    -- Late detection: after 10:45 AM
    ci.log_time::time > '10:45:00'::time as is_late,
    COALESCE(ci.device_id, 'unknown') as device_info
  FROM checkins ci
  LEFT JOIN checkouts co ON ci.employee_id = co.employee_id AND ci.rn = co.rn
  ORDER BY ci.employee_id, ci.log_time;
END;
$$;

-- Run the fixes
SELECT * FROM fix_incorrect_log_types();
SELECT * FROM smart_cleanup_duplicates();

