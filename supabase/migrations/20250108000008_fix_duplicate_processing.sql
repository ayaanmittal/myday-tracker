-- Fix duplicate processing by updating the safe function and cleaning up existing duplicates

-- Update the safe processing function to only process mapped employees
CREATE OR REPLACE FUNCTION public.process_teamoffice_attendance_safe(
  p_empcode TEXT,
  p_name TEXT,
  p_datestring TEXT,
  p_intime TEXT,
  p_outtime TEXT,
  p_worktime TEXT,
  p_status TEXT,
  p_remark TEXT,
  p_raw_payload JSONB
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  day_entry_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_checkin_time TIMESTAMPTZ;
  v_checkout_time TIMESTAMPTZ;
  v_work_minutes INTEGER;
  v_entry_status TEXT;
  v_is_late BOOLEAN;
  v_day_entry_id UUID;
  v_error_message TEXT;
BEGIN
  -- Initialize variables
  success := false;
  message := '';
  day_entry_id := NULL;
  
  BEGIN
    -- Get user mapping - ONLY process if mapping exists
    SELECT our_user_id, our_name INTO v_user_id, v_user_name
    FROM employee_mappings 
    WHERE teamoffice_emp_code = p_empcode
    LIMIT 1;
    
    -- Skip processing if no mapping found
    IF v_user_id IS NULL THEN
      success := false;
      message := 'No employee mapping found for code: ' || p_empcode;
      RETURN NEXT;
      RETURN;
    END IF;
    
    -- Parse check-in time
    v_checkin_time := to_timestamp(p_datestring || ' ' || p_intime, 'DD/MM/YYYY HH24:MI');
    
    -- Parse check-out time if provided and different from check-in
    IF p_outtime IS NOT NULL AND p_outtime != '' AND p_outtime != p_intime THEN
      v_checkout_time := to_timestamp(p_datestring || ' ' || p_outtime, 'DD/MM/YYYY HH24:MI');
    END IF;
    
    -- Convert work time to minutes
    v_work_minutes := EXTRACT(HOUR FROM to_timestamp(p_worktime, 'HH24:MI')) * 60 + 
                     EXTRACT(MINUTE FROM to_timestamp(p_worktime, 'HH24:MI'));
    
    -- Determine status
    v_entry_status := CASE 
      WHEN p_status = 'P' AND v_checkout_time IS NOT NULL THEN 'completed'
      WHEN p_status = 'P' THEN 'in_progress'
      ELSE 'in_progress'
    END;
    
    -- Check if late (after 10:45 AM)
    v_is_late := v_checkin_time::time > '10:45:00'::time;
    
    -- Insert or update day entry
    INSERT INTO day_entries (
      user_id,
      entry_date,
      check_in_at,
      check_out_at,
      total_work_time_minutes,
      status,
      is_late,
      device_info,
      modification_reason
    ) VALUES (
      v_user_id,
      v_checkin_time::date,
      v_checkin_time,
      v_checkout_time,
      v_work_minutes,
      v_entry_status,
      v_is_late,
      'TeamOffice API',
      CASE WHEN p_remark IS NOT NULL THEN 'TeamOffice: ' || p_remark ELSE NULL END
    )
    ON CONFLICT (user_id, entry_date) 
    DO UPDATE SET
      check_in_at = EXCLUDED.check_in_at,
      check_out_at = COALESCE(EXCLUDED.check_out_at, day_entries.check_out_at),
      total_work_time_minutes = EXCLUDED.total_work_time_minutes,
      status = EXCLUDED.status,
      is_late = EXCLUDED.is_late,
      device_info = EXCLUDED.device_info,
      modification_reason = EXCLUDED.modification_reason,
      updated_at = now()
    RETURNING id INTO v_day_entry_id;
    
    success := true;
    message := 'Successfully processed attendance record for ' || v_user_name;
    day_entry_id := v_day_entry_id;
    
  EXCEPTION WHEN OTHERS THEN
    success := false;
    message := 'Error processing attendance: ' || SQLERRM;
    day_entry_id := NULL;
  END;
  
  RETURN NEXT;
END;
$$;

-- Create function to clean up duplicate entries caused by unmapped employee codes
CREATE OR REPLACE FUNCTION public.cleanup_unmapped_duplicates()
RETURNS TABLE (
  removed_entries INTEGER,
  details TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_removed_entries INTEGER := 0;
  v_details TEXT := '';
BEGIN
  -- Remove day entries that don't have corresponding user mappings
  -- These are entries created with raw employee codes instead of mapped user IDs
  WITH unmapped_entries AS (
    SELECT de.id
    FROM day_entries de
    LEFT JOIN employee_mappings em ON de.user_id::text = em.teamoffice_emp_code
    WHERE em.teamoffice_emp_code IS NULL
      AND de.device_info = 'TeamOffice API'
      AND de.user_id::text ~ '^[0-9]+$' -- Only remove entries with numeric employee codes
  )
  DELETE FROM day_entries 
  WHERE id IN (SELECT id FROM unmapped_entries);
  
  GET DIAGNOSTICS v_removed_entries = ROW_COUNT;
  v_details := 'Removed ' || v_removed_entries || ' entries with unmapped employee codes';
  
  RETURN QUERY SELECT v_removed_entries, v_details;
END;
$$;

-- Run the cleanup function
SELECT * FROM public.cleanup_unmapped_duplicates();

