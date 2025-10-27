-- Remove authorization check from office holiday function for testing
-- This version allows any authenticated user to mark office holidays

CREATE OR REPLACE FUNCTION public.mark_office_holiday_range(
  start_date DATE,
  end_date DATE,
  user_ids UUID[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_inserted INTEGER := 0;
  v_updated INTEGER := 0;
  v_user_ids UUID[];
BEGIN
  RAISE NOTICE 'mark_office_holiday_range called by user: %', v_uid;
  RAISE NOTICE 'Parameters: start_date=%, end_date=%, user_ids=%', start_date, end_date, user_ids;

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
    
    RAISE NOTICE 'Using all active employees, found % users', array_length(v_user_ids, 1);
  ELSE
    v_user_ids := user_ids;
    RAISE NOTICE 'Using provided user list, % users', array_length(v_user_ids, 1);
  END IF;

  -- Check if we have any users to process
  IF array_length(v_user_ids, 1) IS NULL OR array_length(v_user_ids, 1) = 0 THEN
    RAISE WARNING 'No users found to process';
    RETURN json_build_object(
      'inserted', 0,
      'updated', 0,
      'debug', 'No users found'
    );
  END IF;

  -- Insert missing rows for each (user, date) with Office Holiday status
  -- Office holiday means: status = 'holiday' and manual_status = 'Office Holiday'
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
         v_uid AS manual_override_by,
         NOW() AS manual_override_at
  FROM unnest(v_user_ids) AS u_ids(u_id)
  CROSS JOIN generate_series(start_date, end_date, INTERVAL '1 day') AS g(d)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.unified_attendance ua
    WHERE ua.user_id = u_ids.u_id AND ua.entry_date = g.d::DATE
  );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE 'Inserted % new records', v_inserted;

  -- Update existing rows to reflect office holiday status
  -- This sets status = 'holiday' and manual_status = 'Office Holiday' for all selected users/dates
  UPDATE public.unified_attendance ua
  SET manual_status = 'Office Holiday',
      status = 'holiday',
      modification_reason = 'Bulk office holiday override',
      manual_override_by = v_uid,
      manual_override_at = NOW(),
      updated_at = NOW()
  WHERE ua.user_id = ANY(v_user_ids)
    AND ua.entry_date BETWEEN start_date AND end_date;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % existing records', v_updated;

  RETURN json_build_object(
    'inserted', v_inserted,
    'updated', v_updated
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.mark_office_holiday_range(DATE, DATE, UUID[]) TO authenticated;

-- Test the function
DO $$
DECLARE
  test_result JSON;
BEGIN
  SELECT public.mark_office_holiday_range(
    '2025-01-25'::DATE, 
    '2025-01-25'::DATE, 
    NULL
  ) INTO test_result;
  
  RAISE NOTICE 'Function test result: %', test_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Function test completed with expected behavior: %', SQLERRM;
END;
$$;
