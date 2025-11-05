-- Fix Late Detection Logic - Corrected Version
-- This script fixes the late detection to properly respect settings

-- Step 1: Drop and recreate the is_checkin_late function with correct logic
DROP FUNCTION IF EXISTS public.is_checkin_late(TIMESTAMPTZ, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.get_late_status_for_checkin(TIMESTAMPTZ);

-- Create the corrected is_checkin_late function
CREATE OR REPLACE FUNCTION public.is_checkin_late(
  checkin_time TIMESTAMPTZ,
  workday_start_time TEXT DEFAULT NULL,
  late_threshold_minutes INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  checkin_date DATE;
  expected_start_time TIMESTAMPTZ;
  late_threshold_time TIMESTAMPTZ;
  v_workday_start TEXT;
  v_late_threshold INTEGER;
BEGIN
  -- Extract date from checkin_time
  checkin_date := checkin_time::DATE;
  
  -- Get settings if not provided
  IF workday_start_time IS NULL THEN
    SELECT value INTO v_workday_start
    FROM public.settings 
    WHERE key = 'workday_start_time' 
    LIMIT 1;
    v_workday_start := COALESCE(v_workday_start, '10:30');
  ELSE
    v_workday_start := workday_start_time;
  END IF;
  
  IF late_threshold_minutes IS NULL THEN
    SELECT value::INTEGER INTO v_late_threshold
    FROM public.settings 
    WHERE key = 'late_threshold_minutes' 
    LIMIT 1;
    v_late_threshold := COALESCE(v_late_threshold, 15);
  ELSE
    v_late_threshold := late_threshold_minutes;
  END IF;
  
  -- Create expected start time for that date
  expected_start_time := checkin_date || ' ' || v_workday_start;
  
  -- Calculate late threshold time
  late_threshold_time := expected_start_time + (v_late_threshold || ' minutes')::INTERVAL;
  
  -- Debug output (remove in production)
  RAISE NOTICE 'Checkin: %, Workday Start: %, Late Threshold: % minutes, Late Threshold Time: %', 
    checkin_time, v_workday_start, v_late_threshold, late_threshold_time;
  
  -- Return true if checkin_time is after the late threshold
  RETURN checkin_time > late_threshold_time;
END;
$$;

-- Step 2: Create a function to get late status for unified_attendance processing
CREATE OR REPLACE FUNCTION public.get_late_status_for_checkin(
  checkin_time TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Use the centralized late detection function
  RETURN public.is_checkin_late(checkin_time);
END;
$$;

-- Step 3: Create a function to test late detection with current settings
CREATE OR REPLACE FUNCTION public.test_late_detection()
RETURNS TABLE(
  test_case TEXT,
  checkin_time TIMESTAMPTZ,
  is_late BOOLEAN,
  workday_start TEXT,
  late_threshold_minutes INTEGER,
  late_threshold_time TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_workday_start TEXT;
  v_late_threshold INTEGER;
  v_test_date DATE := CURRENT_DATE;
BEGIN
  -- Get current settings
  SELECT value INTO v_workday_start
  FROM public.settings 
  WHERE key = 'workday_start_time' 
  LIMIT 1;
  v_workday_start := COALESCE(v_workday_start, '10:30');
  
  SELECT value::INTEGER INTO v_late_threshold
  FROM public.settings 
  WHERE key = 'late_threshold_minutes' 
  LIMIT 1;
  v_late_threshold := COALESCE(v_late_threshold, 15);
  
  -- Test different check-in times
  RETURN QUERY
  SELECT 
    '09:30 (should be NOT late)'::TEXT,
    (v_test_date || ' 09:30:00')::TIMESTAMPTZ,
    public.is_checkin_late((v_test_date || ' 09:30:00')::TIMESTAMPTZ),
    v_workday_start,
    v_late_threshold,
    (v_test_date || ' ' || v_workday_start)::TIMESTAMPTZ + (v_late_threshold || ' minutes')::INTERVAL
    
  UNION ALL
  
  SELECT 
    '10:15 (should be NOT late)'::TEXT,
    (v_test_date || ' 10:15:00')::TIMESTAMPTZ,
    public.is_checkin_late((v_test_date || ' 10:15:00')::TIMESTAMPTZ),
    v_workday_start,
    v_late_threshold,
    (v_test_date || ' ' || v_workday_start)::TIMESTAMPTZ + (v_late_threshold || ' minutes')::INTERVAL
    
  UNION ALL
  
  SELECT 
    '10:30 (should be NOT late - exactly at threshold)'::TEXT,
    (v_test_date || ' 10:30:00')::TIMESTAMPTZ,
    public.is_checkin_late((v_test_date || ' 10:30:00')::TIMESTAMPTZ),
    v_workday_start,
    v_late_threshold,
    (v_test_date || ' ' || v_workday_start)::TIMESTAMPTZ + (v_late_threshold || ' minutes')::INTERVAL
    
  UNION ALL
  
  SELECT 
    '10:31 (should be LATE)'::TEXT,
    (v_test_date || ' 10:31:00')::TIMESTAMPTZ,
    public.is_checkin_late((v_test_date || ' 10:31:00')::TIMESTAMPTZ),
    v_workday_start,
    v_late_threshold,
    (v_test_date || ' ' || v_workday_start)::TIMESTAMPTZ + (v_late_threshold || ' minutes')::INTERVAL
    
  UNION ALL
  
  SELECT 
    '11:00 (should be LATE)'::TEXT,
    (v_test_date || ' 11:00:00')::TIMESTAMPTZ,
    public.is_checkin_late((v_test_date || ' 11:00:00')::TIMESTAMPTZ),
    v_workday_start,
    v_late_threshold,
    (v_test_date || ' ' || v_workday_start)::TIMESTAMPTZ + (v_late_threshold || ' minutes')::INTERVAL;
END;
$$;

-- Step 4: Update the process_teamoffice_attendance function to use proper late detection
CREATE OR REPLACE FUNCTION public.process_teamoffice_attendance(
  p_empcode TEXT,
  p_name TEXT,
  p_datestring TEXT,
  p_intime TEXT,
  p_outtime TEXT,
  p_worktime TEXT,
  p_status TEXT,
  p_remark TEXT,
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
BEGIN
  -- Get user mapping - ONLY process if mapping exists
  SELECT em.our_user_id, p.name INTO v_user_id, v_user_name
  FROM employee_mappings em
  JOIN profiles p ON em.our_profile_id = p.id
  WHERE em.teamoffice_emp_code = p_empcode
  AND em.is_active = true
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
  v_work_minutes := EXTRACT(HOUR FROM to_timestamp(p_worktime, 'HH24:MI')) * 60 + 
                   EXTRACT(MINUTE FROM to_timestamp(p_worktime, 'HH24:MI'));
  
  -- Determine status based on actual times, not just the presence of time strings
  v_entry_status := CASE 
    WHEN v_checkout_time IS NOT NULL THEN 'completed'
    WHEN v_checkin_time IS NOT NULL THEN 'in_progress'
    WHEN p_status = 'A' THEN 'absent'
    ELSE 'in_progress'
  END;
  
  -- Use centralized late detection function
  IF v_checkin_time IS NOT NULL THEN
    v_is_late := public.get_late_status_for_checkin(v_checkin_time);
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
    v_user_name,
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
      WHEN v_checkin_time IS NOT NULL THEN v_checkin_time
      ELSE unified_attendance.check_in_at
    END,
    check_out_at = CASE 
      WHEN v_checkout_time IS NOT NULL THEN v_checkout_time
      ELSE unified_attendance.check_out_at
    END,
    total_work_time_minutes = CASE 
      WHEN v_work_minutes > 0 THEN v_work_minutes
      ELSE unified_attendance.total_work_time_minutes
    END,
    status = CASE 
      WHEN v_entry_status = 'completed' THEN 'completed'
      WHEN v_entry_status = 'absent' THEN 'absent'
      ELSE unified_attendance.status
    END,
    is_late = CASE 
      WHEN v_checkin_time IS NOT NULL THEN v_is_late
      ELSE unified_attendance.is_late
    END,
    device_info = 'TeamOffice API',
    device_id = p_device_id,
    source = 'teamoffice',
    modification_reason = CASE 
      WHEN p_remark IS NOT NULL AND p_remark != '--' THEN 'TeamOffice: ' || p_remark 
      ELSE unified_attendance.modification_reason
    END,
    updated_at = NOW()
  RETURNING id INTO v_attendance_id;
  
  success := true;
  message := 'Attendance processed successfully';
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

-- Step 5: Create a function to update late status for existing records
CREATE OR REPLACE FUNCTION public.update_late_status_for_unified_attendance()
RETURNS TABLE(
  updated_count INTEGER,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  -- Update all unified_attendance records with correct late status
  UPDATE public.unified_attendance 
  SET is_late = public.get_late_status_for_checkin(check_in_at),
      updated_at = NOW()
  WHERE check_in_at IS NOT NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  updated_count := v_updated_count;
  message := 'Updated ' || v_updated_count || ' attendance records with correct late status';
  RETURN NEXT;
END;
$$;

-- Step 6: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_checkin_late(TIMESTAMPTZ, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_late_status_for_checkin(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_late_detection() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_late_status_for_unified_attendance() TO authenticated;

-- Step 7: Test the function
SELECT * FROM public.test_late_detection();

-- Step 8: Update existing records
SELECT * FROM public.update_late_status_for_unified_attendance();



