-- Fix attendance issues: add unique constraint and improve data integrity

-- Add unique constraint to prevent duplicate day entries (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'day_entries_user_date_unique'
    ) THEN
        ALTER TABLE public.day_entries 
        ADD CONSTRAINT day_entries_user_date_unique UNIQUE (user_id, entry_date);
    END IF;
END $$;

-- Create function to handle TeamOffice API certificate issues
CREATE OR REPLACE FUNCTION public.handle_teamoffice_certificate_error()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Log the certificate error
  INSERT INTO public.api_refresh_logs (
    user_id,
    operation_type,
    success,
    error_message,
    records_processed,
    duration_ms
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, -- System user
    'teamoffice_sync',
    false,
    'TeamOffice API certificate has expired. Please contact the API provider to renew the certificate.',
    0,
    0
  );
END;
$$;

-- Create function to clean up and fix attendance data
CREATE OR REPLACE FUNCTION public.fix_attendance_data()
RETURNS TABLE (
  fixed_duplicates INTEGER,
  fixed_checkouts INTEGER,
  details TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_fixed_duplicates INTEGER := 0;
  v_fixed_checkouts INTEGER := 0;
  v_details TEXT := '';
BEGIN
  -- Remove duplicate day entries, keeping the most recent one
  WITH duplicates AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, entry_date 
        ORDER BY updated_at DESC, created_at DESC
      ) as rn
    FROM day_entries
  )
  DELETE FROM day_entries 
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
  
  GET DIAGNOSTICS v_fixed_duplicates = ROW_COUNT;
  
  -- Fix entries that should have check-out times but don't
  -- This is a heuristic: if work time > 0 but no check-out, try to calculate it
  UPDATE day_entries 
  SET 
    check_out_at = check_in_at + INTERVAL '1 minute' * total_work_time_minutes,
    status = 'completed'
  WHERE 
    check_in_at IS NOT NULL 
    AND check_out_at IS NULL 
    AND total_work_time_minutes > 0
    AND status = 'in_progress';
  
  GET DIAGNOSTICS v_fixed_checkouts = ROW_COUNT;
  
  v_details := 'Fixed ' || v_fixed_duplicates || ' duplicate entries and ' || v_fixed_checkouts || ' missing checkouts';
  
  RETURN QUERY SELECT v_fixed_duplicates, v_fixed_checkouts, v_details;
END;
$$;

-- Create function to get attendance data with proper check-in/check-out pairs
CREATE OR REPLACE FUNCTION public.get_attendance_with_pairs(
  p_user_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  entry_date DATE,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  total_work_time_minutes INTEGER,
  status TEXT,
  is_late BOOLEAN,
  device_info TEXT,
  modification_reason TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    de.id,
    de.user_id,
    de.entry_date,
    de.check_in_at,
    de.check_out_at,
    de.total_work_time_minutes,
    de.status,
    de.is_late,
    de.device_info,
    de.modification_reason,
    de.created_at,
    de.updated_at
  FROM day_entries de
  WHERE (p_user_id IS NULL OR de.user_id = p_user_id)
    AND (p_start_date IS NULL OR de.entry_date >= p_start_date)
    AND (p_end_date IS NULL OR de.entry_date <= p_end_date)
  ORDER BY de.entry_date DESC, de.created_at DESC;
END;
$$;

-- Create function to process TeamOffice data with better error handling
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
    message := 'Successfully processed attendance record';
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

-- Run the cleanup functions
SELECT * FROM public.fix_attendance_data();
SELECT * FROM public.cleanup_unmapped_duplicates();
