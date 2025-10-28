-- Fix TeamOffice Auto-Marking Issue
-- This script modifies the TeamOffice processing to respect office holidays

-- Step 1: Check the current TeamOffice processing function
SELECT 'Step 1: Current TeamOffice processing function' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'process_teamoffice_unified_attendance';

-- Step 2: Create a modified version that respects office holidays
CREATE OR REPLACE FUNCTION public.process_teamoffice_unified_attendance_fixed(
  p_empcode TEXT,
  p_name TEXT,
  p_datestring TEXT,
  p_intime TEXT DEFAULT NULL,
  p_outtime TEXT DEFAULT NULL,
  p_worktime TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_remark TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  attendance_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_checkin_time TIMESTAMPTZ;
  v_checkout_time TIMESTAMPTZ;
  v_work_minutes INTEGER;
  v_entry_status TEXT;
  v_is_late BOOLEAN := false;
  v_attendance_id UUID;
  v_is_office_holiday BOOLEAN := false;
BEGIN
  -- Get user mapping - ONLY process if mapping exists
  SELECT our_user_id, our_name INTO v_user_id, v_user_name
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
  
  -- Check if this is an office holiday
  SELECT EXISTS(
    SELECT 1 FROM public.unified_attendance 
    WHERE user_id = v_user_id 
      AND entry_date = to_date(p_datestring, 'DD/MM/YYYY')
      AND manual_status = 'Office Holiday'
  ) INTO v_is_office_holiday;
  
  -- If it's an office holiday, skip processing to avoid overriding
  IF v_is_office_holiday THEN
    success := true;
    message := 'Skipped processing - Office holiday detected for ' || COALESCE(v_user_name, p_name);
    attendance_id := NULL;
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
  v_work_minutes := EXTRACT(HOUR FROM to_timestamp(p_worktime, 'HH24:MI')) * 60 + 
                   EXTRACT(MINUTE FROM to_timestamp(p_worktime, 'HH24:MI'));
  
  -- Determine status based on actual times, not just the presence of time strings
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
    COALESCE(v_user_name, p_name), -- Use mapped name, fallback to TeamOffice name
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
    -- Fix status logic: only update if we have new data AND it's not an office holiday
    status = CASE 
      WHEN EXCLUDED.check_out_at IS NOT NULL AND EXCLUDED.check_in_at IS NOT NULL THEN 'completed'
      WHEN EXCLUDED.check_in_at IS NOT NULL AND EXCLUDED.check_out_at IS NULL THEN 'in_progress'
      WHEN EXCLUDED.check_in_at IS NULL AND EXCLUDED.check_out_at IS NULL AND unified_attendance.manual_status != 'Office Holiday' THEN 'absent'
      ELSE unified_attendance.status
    END,
    is_late = CASE 
      WHEN EXCLUDED.check_in_at IS NOT NULL THEN EXCLUDED.is_late
      ELSE unified_attendance.is_late
    END,
    device_info = 'TeamOffice API',
    device_id = COALESCE(EXCLUDED.device_id, unified_attendance.device_id),
    source = 'teamoffice',
    modification_reason = CASE 
      WHEN EXCLUDED.modification_reason IS NOT NULL THEN EXCLUDED.modification_reason
      ELSE unified_attendance.modification_reason
    END,
    updated_at = now()
  RETURNING id INTO v_attendance_id;
  
  success := true;
  message := 'Successfully processed attendance for ' || COALESCE(v_user_name, p_name);
  attendance_id := v_attendance_id;
  RETURN NEXT;
  RETURN;
END;
$$;

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION public.process_teamoffice_unified_attendance_fixed(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Step 4: Test the fixed function
SELECT 'Step 4: Test fixed TeamOffice function' as step;
-- This would normally be called by the TeamOffice integration, but we can test it manually

-- Step 5: Update the original function to use the fixed logic
CREATE OR REPLACE FUNCTION public.process_teamoffice_unified_attendance(
  p_empcode TEXT,
  p_name TEXT,
  p_datestring TEXT,
  p_intime TEXT DEFAULT NULL,
  p_outtime TEXT DEFAULT NULL,
  p_worktime TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_remark TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  attendance_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_checkin_time TIMESTAMPTZ;
  v_checkout_time TIMESTAMPTZ;
  v_work_minutes INTEGER;
  v_entry_status TEXT;
  v_is_late BOOLEAN := false;
  v_attendance_id UUID;
  v_is_office_holiday BOOLEAN := false;
BEGIN
  -- Get user mapping - ONLY process if mapping exists
  SELECT our_user_id, our_name INTO v_user_id, v_user_name
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
  
  -- Check if this is an office holiday
  SELECT EXISTS(
    SELECT 1 FROM public.unified_attendance 
    WHERE user_id = v_user_id 
      AND entry_date = to_date(p_datestring, 'DD/MM/YYYY')
      AND manual_status = 'Office Holiday'
  ) INTO v_is_office_holiday;
  
  -- If it's an office holiday, skip processing to avoid overriding
  IF v_is_office_holiday THEN
    success := true;
    message := 'Skipped processing - Office holiday detected for ' || COALESCE(v_user_name, p_name);
    attendance_id := NULL;
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
  v_work_minutes := EXTRACT(HOUR FROM to_timestamp(p_worktime, 'HH24:MI')) * 60 + 
                   EXTRACT(MINUTE FROM to_timestamp(p_worktime, 'HH24:MI'));
  
  -- Determine status based on actual times, not just the presence of time strings
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
    COALESCE(v_user_name, p_name), -- Use mapped name, fallback to TeamOffice name
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
    -- Fix status logic: only update if we have new data AND it's not an office holiday
    status = CASE 
      WHEN EXCLUDED.check_out_at IS NOT NULL AND EXCLUDED.check_in_at IS NOT NULL THEN 'completed'
      WHEN EXCLUDED.check_in_at IS NOT NULL AND EXCLUDED.check_out_at IS NULL THEN 'in_progress'
      WHEN EXCLUDED.check_in_at IS NULL AND EXCLUDED.check_out_at IS NULL AND unified_attendance.manual_status != 'Office Holiday' THEN 'absent'
      ELSE unified_attendance.status
    END,
    is_late = CASE 
      WHEN EXCLUDED.check_in_at IS NOT NULL THEN EXCLUDED.is_late
      ELSE unified_attendance.is_late
    END,
    device_info = 'TeamOffice API',
    device_id = COALESCE(EXCLUDED.device_id, unified_attendance.device_id),
    source = 'teamoffice',
    modification_reason = CASE 
      WHEN EXCLUDED.modification_reason IS NOT NULL THEN EXCLUDED.modification_reason
      ELSE unified_attendance.modification_reason
    END,
    updated_at = now()
  RETURNING id INTO v_attendance_id;
  
  success := true;
  message := 'Successfully processed attendance for ' || COALESCE(v_user_name, p_name);
  attendance_id := v_attendance_id;
  RETURN NEXT;
  RETURN;
END;
$$;

-- Step 6: Test the office holiday function again
SELECT 'Step 6: Test office holiday function after fix' as step;
SELECT public.mark_office_holiday_range(
  '2025-02-07'::DATE, 
  '2025-02-07'::DATE, 
  NULL
) as result;

-- Step 7: Check if the fix worked
SELECT 'Step 7: Check if fix worked' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-02-07'::DATE
ORDER BY p.name;

