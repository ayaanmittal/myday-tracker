-- Fix individual punch processing to prevent duplicates

-- Create function to process individual punch records
CREATE OR REPLACE FUNCTION public.process_individual_punch(
  p_empcode TEXT,
  p_name TEXT,
  p_datestring TEXT,
  p_intime TEXT DEFAULT NULL,
  p_outtime TEXT DEFAULT NULL,
  p_worktime TEXT DEFAULT '00:00',
  p_status TEXT DEFAULT 'P',
  p_remark TEXT DEFAULT NULL,
  p_raw_payload JSONB DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  day_entry_id UUID
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
  v_day_entry_id UUID;
  v_existing_entry RECORD;
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
  
  -- Parse times if provided
  IF p_intime IS NOT NULL AND p_intime != '' THEN
    v_checkin_time := to_timestamp(p_datestring || ' ' || p_intime, 'DD/MM/YYYY HH24:MI');
  END IF;
  
  IF p_outtime IS NOT NULL AND p_outtime != '' THEN
    v_checkout_time := to_timestamp(p_datestring || ' ' || p_outtime, 'DD/MM/YYYY HH24:MI');
  END IF;
  
  -- Convert work time to minutes
  v_work_minutes := EXTRACT(HOUR FROM to_timestamp(p_worktime, 'HH24:MI')) * 60 + 
                   EXTRACT(MINUTE FROM to_timestamp(p_worktime, 'HH24:MI'));
  
  -- Check for existing entry for this user and date
  SELECT * INTO v_existing_entry
  FROM day_entries 
  WHERE user_id = v_user_id 
    AND entry_date = v_checkin_time::date
  LIMIT 1;
  
  -- If entry exists, update it
  IF v_existing_entry.id IS NOT NULL THEN
    -- Update existing entry
    UPDATE day_entries SET
      check_in_at = CASE 
        WHEN p_intime IS NOT NULL AND p_intime != '' THEN v_checkin_time
        ELSE check_in_at
      END,
      check_out_at = CASE 
        WHEN p_outtime IS NOT NULL AND p_outtime != '' THEN v_checkout_time
        ELSE check_out_at
      END,
      total_work_time_minutes = CASE 
        WHEN p_outtime IS NOT NULL AND p_outtime != '' AND p_intime IS NOT NULL AND p_intime != '' THEN v_work_minutes
        ELSE total_work_time_minutes
      END,
      status = CASE 
        WHEN p_outtime IS NOT NULL AND p_outtime != '' THEN 'completed'
        WHEN p_intime IS NOT NULL AND p_intime != '' THEN 'in_progress'
        ELSE status
      END,
      is_late = CASE 
        WHEN p_intime IS NOT NULL AND p_intime != '' THEN 
          COALESCE(
            (SELECT result FROM is_checkin_late(v_checkin_time::date, v_checkin_time::time)),
            false
          )
        ELSE is_late
      END,
      device_info = 'TeamOffice API',
      modification_reason = CASE 
        WHEN p_remark IS NOT NULL THEN 'TeamOffice: ' || p_remark 
        ELSE modification_reason
      END,
      updated_at = now()
    WHERE id = v_existing_entry.id
    RETURNING id INTO v_day_entry_id;
    
    success := true;
    message := 'Updated existing entry for ' || v_user_name;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- If no existing entry, create new one (only if we have check-in time)
  IF p_intime IS NOT NULL AND p_intime != '' THEN
    -- Determine status
    v_entry_status := CASE 
      WHEN p_outtime IS NOT NULL AND p_outtime != '' THEN 'completed'
      ELSE 'in_progress'
    END;
    
    -- Check if check-in is late
    v_is_late := COALESCE(
      (SELECT result FROM is_checkin_late(v_checkin_time::date, v_checkin_time::time)),
      false
    );
    
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
    RETURNING id INTO v_day_entry_id;
    
    success := true;
    message := 'Created new entry for ' || v_user_name;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- If we only have check-out time but no existing entry, skip
  success := false;
  message := 'No check-in time provided and no existing entry found for ' || v_user_name;
  RETURN NEXT;
  RETURN;
END;
$$;

-- Create a wrapper function that processes multiple records
CREATE OR REPLACE FUNCTION public.process_teamoffice_attendance_individual(
  p_records JSONB
)
RETURNS TABLE (
  processed INTEGER,
  errors TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  record JSONB;
  result RECORD;
  error_count INTEGER := 0;
  error_messages TEXT[] := '{}';
  processed_count INTEGER := 0;
BEGIN
  -- Process each record
  FOR record IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    BEGIN
      SELECT * INTO result FROM process_individual_punch(
        (record->>'Empcode')::TEXT,
        (record->>'Name')::TEXT,
        (record->>'DateString')::TEXT,
        (record->>'INTime')::TEXT,
        (record->>'OUTTime')::TEXT,
        (record->>'WorkTime')::TEXT,
        (record->>'Status')::TEXT,
        (record->>'Remark')::TEXT,
        record
      );
      
      IF result.success THEN
        processed_count := processed_count + 1;
      ELSE
        error_count := error_count + 1;
        error_messages := array_append(error_messages, result.message);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      error_messages := array_append(error_messages, 'Error processing record: ' || SQLERRM);
    END;
  END LOOP;
  
  RETURN QUERY SELECT processed_count, error_messages;
END;
$$;

