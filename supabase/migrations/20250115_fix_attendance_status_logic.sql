-- Fix attendance status logic issues
-- This migration addresses the problems with status determination and employee name resolution

-- 1. Fix the status trigger logic to be more robust
CREATE OR REPLACE FUNCTION update_attendance_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Don't override manual status settings (holiday, leave_granted, etc.)
  -- Only update if status is one of the basic attendance statuses
  IF NEW.status IN ('in_progress', 'completed', 'absent') THEN
    -- If both check_in_at and check_out_at are NULL, status should be absent
    IF NEW.check_in_at IS NULL AND NEW.check_out_at IS NULL THEN
      NEW.status := 'absent';
    -- If check_in_at exists but check_out_at is NULL, status should be in_progress
    ELSIF NEW.check_in_at IS NOT NULL AND NEW.check_out_at IS NULL THEN
      NEW.status := 'in_progress';
    -- If both check_in_at and check_out_at exist, status should be completed
    ELSIF NEW.check_in_at IS NOT NULL AND NEW.check_out_at IS NOT NULL THEN
      NEW.status := 'completed';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix the unified attendance processing function to have consistent status logic
CREATE OR REPLACE FUNCTION public.process_teamoffice_unified_attendance(
  p_empcode TEXT,
  p_name TEXT,
  p_datestring TEXT,
  p_intime TEXT DEFAULT NULL,
  p_outtime TEXT DEFAULT NULL,
  p_worktime TEXT DEFAULT '00:00',
  p_status TEXT DEFAULT 'P',
  p_remark TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL,
  p_raw_payload JSONB DEFAULT NULL
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
    -- Fix status logic: only update if we have new data
    status = CASE 
      WHEN EXCLUDED.check_out_at IS NOT NULL AND EXCLUDED.check_in_at IS NOT NULL THEN 'completed'
      WHEN EXCLUDED.check_in_at IS NOT NULL AND EXCLUDED.check_out_at IS NULL THEN 'in_progress'
      WHEN EXCLUDED.check_in_at IS NULL AND EXCLUDED.check_out_at IS NULL THEN 'absent'
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

-- 3. Create function to fix existing records with incorrect status
CREATE OR REPLACE FUNCTION fix_incorrect_attendance_status()
RETURNS TABLE(
  user_id UUID,
  entry_date DATE,
  old_status TEXT,
  new_status TEXT,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Update records where status doesn't match the actual check-in/out times
  UPDATE unified_attendance 
  SET status = CASE
    WHEN unified_attendance.check_in_at IS NULL AND unified_attendance.check_out_at IS NULL THEN 'absent'
    WHEN unified_attendance.check_in_at IS NOT NULL AND unified_attendance.check_out_at IS NULL THEN 'in_progress'
    WHEN unified_attendance.check_in_at IS NOT NULL AND unified_attendance.check_out_at IS NOT NULL THEN 'completed'
    ELSE unified_attendance.status
  END
  WHERE unified_attendance.status != CASE
    WHEN unified_attendance.check_in_at IS NULL AND unified_attendance.check_out_at IS NULL THEN 'absent'
    WHEN unified_attendance.check_in_at IS NOT NULL AND unified_attendance.check_out_at IS NULL THEN 'in_progress'
    WHEN unified_attendance.check_in_at IS NOT NULL AND unified_attendance.check_out_at IS NOT NULL THEN 'completed'
    ELSE unified_attendance.status
  END;
  
  -- Return the corrected records
  RETURN QUERY
  SELECT 
    ua.user_id,
    ua.entry_date,
    ua.status as old_status,
    CASE
      WHEN ua.check_in_at IS NULL AND ua.check_out_at IS NULL THEN 'absent'
      WHEN ua.check_in_at IS NOT NULL AND ua.check_out_at IS NULL THEN 'in_progress'
      WHEN ua.check_in_at IS NOT NULL AND ua.check_out_at IS NOT NULL THEN 'completed'
      ELSE ua.status
    END as new_status,
    ua.check_in_at,
    ua.check_out_at
  FROM unified_attendance ua
  WHERE ua.status != CASE
    WHEN ua.check_in_at IS NULL AND ua.check_out_at IS NULL THEN 'absent'
    WHEN ua.check_in_at IS NOT NULL AND ua.check_out_at IS NULL THEN 'in_progress'
    WHEN ua.check_in_at IS NOT NULL AND ua.check_out_at IS NOT NULL THEN 'completed'
    ELSE ua.status
  END;
END;
$$ LANGUAGE plpgsql;

-- 4. Create function to fix employee name issues
CREATE OR REPLACE FUNCTION fix_employee_names()
RETURNS TABLE(
  user_id UUID,
  old_name TEXT,
  new_name TEXT,
  employee_code TEXT
) AS $$
BEGIN
  -- Update employee names from profiles where they are NULL or 'Unknown'
  UPDATE unified_attendance 
  SET employee_name = p.name
  FROM employee_mappings em
  JOIN profiles p ON em.our_profile_id = p.id
  WHERE unified_attendance.user_id = em.our_user_id
    AND em.is_active = true
    AND (unified_attendance.employee_name IS NULL 
         OR unified_attendance.employee_name = 'Unknown'
         OR unified_attendance.employee_name = '');
  
  -- Return the updated records
  RETURN QUERY
  SELECT 
    ua.user_id,
    ua.employee_name as old_name,
    p.name as new_name,
    ua.employee_code
  FROM unified_attendance ua
  JOIN employee_mappings em ON ua.user_id = em.our_user_id
  JOIN profiles p ON em.our_profile_id = p.id
  WHERE em.is_active = true
    AND (ua.employee_name IS NULL 
         OR ua.employee_name = 'Unknown'
         OR ua.employee_name = '');
END;
$$ LANGUAGE plpgsql;

-- 5. Run the fixes
SELECT 'Fixing attendance status logic...' as message;
SELECT * FROM fix_incorrect_attendance_status();

SELECT 'Fixing employee names...' as message;
SELECT * FROM fix_employee_names();

-- 6. Show summary of fixes
DO $$
DECLARE
  status_fixes INTEGER;
  name_fixes INTEGER;
BEGIN
  SELECT COUNT(*) INTO status_fixes FROM fix_incorrect_attendance_status();
  SELECT COUNT(*) INTO name_fixes FROM fix_employee_names();
  
  RAISE NOTICE 'Attendance Status Fixes Applied: %', status_fixes;
  RAISE NOTICE 'Employee Name Fixes Applied: %', name_fixes;
  RAISE NOTICE 'Migration completed successfully!';
END;
$$;
