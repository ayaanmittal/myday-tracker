-- Fix the process_teamoffice_unified_attendance function to properly handle employee mappings

CREATE OR REPLACE FUNCTION public.process_teamoffice_unified_attendance(
  p_empcode TEXT,
  p_name TEXT,
  p_datestring TEXT,
  p_intime TEXT,
  p_outtime TEXT,
  p_worktime TEXT,
  p_status TEXT,
  p_remark TEXT,
  p_device_id TEXT DEFAULT 'teamoffice'
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  attendance_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_checkin_time TIMESTAMPTZ;
  v_checkout_time TIMESTAMPTZ;
  v_work_minutes INTEGER;
  v_entry_status TEXT;
  v_is_late BOOLEAN := false;
  v_attendance_id UUID;
BEGIN
  -- Get user mapping - ONLY process if mapping exists
  SELECT our_user_id INTO v_user_id
  FROM employee_mappings 
  WHERE teamoffice_emp_code = p_empcode
  AND is_active = true
  LIMIT 1;
  
  -- Skip processing if no mapping found
  IF v_user_id IS NULL THEN
    success := false;
    message := 'No employee mapping found for code: ' || p_empcode;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Parse times if provided
  IF p_intime IS NOT NULL AND p_intime != '' AND p_intime != '--:--' THEN
    v_checkin_time := to_timestamp(p_datestring || ' ' || p_intime, 'DD/MM/YYYY HH24:MI');
  END IF;
  
  IF p_outtime IS NOT NULL AND p_outtime != '' AND p_outtime != '--:--' THEN
    v_checkout_time := to_timestamp(p_datestring || ' ' || p_outtime, 'DD/MM/YYYY HH24:MI');
  END IF;
  
  -- Convert work time to minutes
  IF p_worktime IS NOT NULL AND p_worktime != '' AND p_worktime != '00:00' THEN
    v_work_minutes := EXTRACT(HOUR FROM to_timestamp(p_worktime, 'HH24:MI')) * 60 + 
                     EXTRACT(MINUTE FROM to_timestamp(p_worktime, 'HH24:MI'));
  ELSE
    v_work_minutes := 0;
  END IF;
  
  -- Determine status based on presence of times
  v_entry_status := CASE 
    WHEN v_checkout_time IS NOT NULL THEN 'completed'
    WHEN v_checkin_time IS NOT NULL THEN 'in_progress'
    WHEN p_status = 'A' THEN 'absent'
    ELSE 'in_progress'
  END;
  
  -- Check if check-in is late (simplified logic for now)
  IF v_checkin_time IS NOT NULL THEN
    -- Simple late detection: after 10:45 AM is late
    v_is_late := EXTRACT(HOUR FROM v_checkin_time) > 10 OR 
                 (EXTRACT(HOUR FROM v_checkin_time) = 10 AND EXTRACT(MINUTE FROM v_checkin_time) > 45);
  END IF;
  
  -- Insert or update attendance record
  INSERT INTO unified_attendance (
    user_id,
    employee_code,
    employee_name,
    entry_date,
    check_in_at,
    check_out_at,
    total_work_time_minutes,
    status,
    is_late,
    device_info,
    device_id,
    source,
    modification_reason
  ) VALUES (
    v_user_id,
    p_empcode,
    p_name,
    v_checkin_time::date,
    v_checkin_time,
    v_checkout_time,
    v_work_minutes,
    v_entry_status,
    v_is_late,
    'TeamOffice API',
    p_device_id,
    'teamoffice',
    CASE WHEN p_remark IS NOT NULL AND p_remark != '--' THEN 'TeamOffice: ' || p_remark ELSE NULL END
  )
  ON CONFLICT (user_id, entry_date) 
  DO UPDATE SET
    check_in_at = CASE 
      WHEN EXCLUDED.check_in_at IS NOT NULL THEN EXCLUDED.check_in_at
      ELSE unified_attendance.check_in_at
    END,
    check_out_at = CASE 
      WHEN EXCLUDED.check_out_at IS NOT NULL THEN EXCLUDED.check_out_at
      ELSE unified_attendance.check_out_at
    END,
    total_work_time_minutes = CASE 
      WHEN EXCLUDED.check_out_at IS NOT NULL AND EXCLUDED.check_in_at IS NOT NULL THEN EXCLUDED.total_work_time_minutes
      ELSE unified_attendance.total_work_time_minutes
    END,
    status = CASE 
      WHEN EXCLUDED.check_out_at IS NOT NULL THEN 'completed'
      WHEN EXCLUDED.check_in_at IS NOT NULL THEN 'in_progress'
      ELSE unified_attendance.status
    END,
    is_late = EXCLUDED.is_late,
    device_info = EXCLUDED.device_info,
    device_id = EXCLUDED.device_id,
    modification_reason = EXCLUDED.modification_reason,
    updated_at = now()
  RETURNING id INTO v_attendance_id;
  
  success := true;
  message := 'Successfully processed attendance for ' || p_name || ' (' || p_empcode || ')';
  attendance_id := v_attendance_id;
  RETURN NEXT;
  
EXCEPTION
  WHEN OTHERS THEN
    success := false;
    message := 'Error processing attendance: ' || SQLERRM;
    attendance_id := NULL;
    RETURN NEXT;
END;
$$;

