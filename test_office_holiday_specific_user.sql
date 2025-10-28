-- Test office holiday function with a specific user to isolate the issue
-- This will help identify if the problem is with user selection or the function itself

-- Step 1: Get a specific active user for testing
SELECT 'Step 1: Getting a specific active user for testing' as step;
SELECT 
  id,
  name,
  email,
  is_active
FROM public.profiles 
WHERE is_active = true 
LIMIT 1;

-- Step 2: Test with a specific user ID
DO $$
DECLARE
  test_user_id UUID;
  test_result JSON;
BEGIN
  -- Get the first active user
  SELECT id INTO test_user_id 
  FROM public.profiles 
  WHERE is_active = true 
  LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'No active users found for testing';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Testing with user ID: %', test_user_id;
  
  -- Test the function with this specific user
  SELECT public.mark_office_holiday_range(
    '2025-01-25'::DATE, 
    '2025-01-25'::DATE, 
    ARRAY[test_user_id]
  ) INTO test_result;
  
  RAISE NOTICE 'Function result: %', test_result;
  
  -- Check if the record was updated
  PERFORM 1 FROM public.unified_attendance 
  WHERE user_id = test_user_id 
    AND entry_date = '2025-01-25'::DATE
    AND manual_status = 'Office Holiday';
    
  IF FOUND THEN
    RAISE NOTICE 'SUCCESS: Record was updated correctly';
  ELSE
    RAISE NOTICE 'FAILED: Record was not updated';
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error during test: %', SQLERRM;
END;
$$;

-- Step 3: Check the specific user's record after the test
SELECT 'Step 3: Checking the specific user record after test' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  ua.manual_override_by,
  ua.manual_override_at,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-01-25'::DATE
  AND p.is_active = true
ORDER BY p.name;

-- Step 4: Test manual update to verify the table is writable
SELECT 'Step 4: Testing manual update to verify table is writable' as step;
DO $$
DECLARE
  test_user_id UUID;
  update_count INTEGER;
BEGIN
  -- Get the first active user
  SELECT id INTO test_user_id 
  FROM public.profiles 
  WHERE is_active = true 
  LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'No active users found for manual test';
    RETURN;
  END IF;
  
  -- Try to manually update a record
  UPDATE public.unified_attendance 
  SET manual_status = 'Manual Test Update',
      status = 'holiday',
      modification_reason = 'Manual test',
      manual_override_by = auth.uid(),
      manual_override_at = NOW(),
      updated_at = NOW()
  WHERE user_id = test_user_id 
    AND entry_date = '2025-01-25'::DATE;
    
  GET DIAGNOSTICS update_count = ROW_COUNT;
  RAISE NOTICE 'Manual update affected % rows', update_count;
  
  IF update_count > 0 THEN
    RAISE NOTICE 'SUCCESS: Manual update worked';
  ELSE
    RAISE NOTICE 'FAILED: Manual update did not work - no rows affected';
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error during manual update: %', SQLERRM;
END;
$$;

