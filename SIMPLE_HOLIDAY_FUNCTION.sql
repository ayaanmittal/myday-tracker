-- Simple holiday function for testing without authentication requirements
-- This function bypasses authentication for testing purposes

CREATE OR REPLACE FUNCTION public.mark_office_holiday_simple(
  start_date DATE,
  end_date DATE,
  user_ids UUID[] DEFAULT NULL,
  holiday_name TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_attendance INTEGER := 0;
  v_updated_attendance INTEGER := 0;
  v_inserted_holidays INTEGER := 0;
  v_user_ids UUID[];
  v_current_date DATE;
  v_holiday_title TEXT;
BEGIN
  -- Validation
  IF start_date IS NULL OR end_date IS NULL OR start_date > end_date THEN
    RAISE EXCEPTION 'Invalid date range: start_date=%, end_date=%', start_date, end_date;
  END IF;

  -- Get user IDs (all active employees if not specified)
  IF user_ids IS NULL OR array_length(user_ids, 1) IS NULL OR array_length(user_ids, 1) = 0 THEN
    SELECT COALESCE(array_agg(p.id), '{}')
    INTO v_user_ids
    FROM public.profiles p
    WHERE COALESCE(p.is_active, TRUE) = TRUE;
  ELSE
    v_user_ids := user_ids;
  END IF;

  -- Check if we have any users to process
  IF array_length(v_user_ids, 1) IS NULL OR array_length(v_user_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No users found to process';
  END IF;

  -- Set holiday title
  v_holiday_title := COALESCE(holiday_name, 'Office Holiday');

  -- Step 1: Insert office holidays into company_holidays table
  v_current_date := start_date;
  WHILE v_current_date <= end_date LOOP
    -- Insert into company_holidays (ignore if already exists)
    INSERT INTO public.company_holidays (holiday_date, title, created_by)
    VALUES (v_current_date, v_holiday_title, '00000000-0000-0000-0000-000000000000'::UUID)
    ON CONFLICT (holiday_date) 
    DO UPDATE SET 
      title = EXCLUDED.title,
      created_by = EXCLUDED.created_by,
      created_at = NOW();
    
    -- Count inserted holidays
    IF FOUND THEN
      v_inserted_holidays := v_inserted_holidays + 1;
    END IF;
    
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  -- Step 2: Insert missing attendance records for each (user, date) with Office Holiday status
  INSERT INTO public.unified_attendance (
    user_id, entry_date, device_info, source, status, manual_status, modification_reason, manual_override_by, manual_override_at
  )
  SELECT u_ids.u_id AS user_id,
         g.d::DATE AS entry_date,
         'System Override' AS device_info,
         'manual' AS source,
         'holiday' AS status,
         'Office Holiday'::VARCHAR AS manual_status,
         'Bulk office holiday override' AS modification_reason,
         '00000000-0000-0000-0000-000000000000'::UUID AS manual_override_by,
         NOW() AS manual_override_at
  FROM unnest(v_user_ids) AS u_ids(u_id)
  CROSS JOIN generate_series(start_date, end_date, INTERVAL '1 day') AS g(d)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.unified_attendance ua
    WHERE ua.user_id = u_ids.u_id AND ua.entry_date = g.d::DATE
  );

  GET DIAGNOSTICS v_inserted_attendance = ROW_COUNT;

  -- Step 3: Update existing attendance records to reflect office holiday status
  UPDATE public.unified_attendance ua
  SET manual_status = 'Office Holiday',
      status = 'holiday',
      modification_reason = 'Bulk office holiday override',
      manual_override_by = '00000000-0000-0000-0000-000000000000'::UUID,
      manual_override_at = NOW(),
      updated_at = NOW()
  WHERE ua.user_id = ANY(v_user_ids)
    AND ua.entry_date BETWEEN start_date AND end_date
    AND (ua.manual_status != 'Office Holiday' OR ua.status != 'holiday');

  GET DIAGNOSTICS v_updated_attendance = ROW_COUNT;

  -- Return success response
  RETURN json_build_object(
    'success', true,
    'inserted_attendance', v_inserted_attendance,
    'updated_attendance', v_updated_attendance,
    'inserted_holidays', v_inserted_holidays,
    'total_processed', v_inserted_attendance + v_updated_attendance,
    'message', format('Successfully processed %s office holiday days for %s employees', 
                      (end_date - start_date + 1)::TEXT, 
                      array_length(v_user_ids, 1)::TEXT)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'inserted_attendance', v_inserted_attendance,
      'updated_attendance', v_updated_attendance,
      'inserted_holidays', v_inserted_holidays
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.mark_office_holiday_simple(DATE, DATE, UUID[], TEXT) TO authenticated;

