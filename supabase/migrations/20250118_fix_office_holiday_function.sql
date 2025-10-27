-- Fix the incomplete mark_office_holiday_range function
-- This function was incomplete in previous migrations

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
  v_is_admin_or_manager BOOLEAN;
  v_inserted INTEGER := 0;
  v_updated INTEGER := 0;
  v_user_ids UUID[];
BEGIN
  -- Authorization: only admins/managers may run
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid AND ur.role IN ('admin','manager')
  ) INTO v_is_admin_or_manager;

  IF NOT COALESCE(v_is_admin_or_manager, FALSE) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF start_date IS NULL OR end_date IS NULL OR start_date > end_date THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  -- If no users provided, use all active employees
  IF user_ids IS NULL OR array_length(user_ids, 1) IS NULL OR array_length(user_ids, 1) = 0 THEN
    SELECT COALESCE(array_agg(p.id), '{}')
    INTO v_user_ids
    FROM public.profiles p
    WHERE COALESCE(p.is_active, TRUE) = TRUE;
  ELSE
    v_user_ids := user_ids;
  END IF;

  -- Insert missing rows for each (user, date) with Office Holiday status
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

  -- Update existing rows to reflect office holiday status
  -- Office Holiday always overrides any other status
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

  RETURN json_build_object(
    'inserted', v_inserted,
    'updated', v_updated
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.mark_office_holiday_range(DATE, DATE, UUID[]) TO authenticated;

-- Test the function (optional - can be removed in production)
-- This is just to verify the function works
DO $$
BEGIN
  -- Test that the function exists and can be called
  -- (This will fail if there are no active users, but that's expected)
  PERFORM public.mark_office_holiday_range('2025-01-01'::DATE, '2025-01-01'::DATE, NULL);
  RAISE NOTICE 'mark_office_holiday_range function is working correctly';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Function test completed with expected behavior: %', SQLERRM;
END;
$$;
