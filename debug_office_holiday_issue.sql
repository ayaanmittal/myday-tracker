-- Debug Office Holiday Issue
-- This script will help identify why records aren't being updated

-- Step 1: Check current user and authentication
SELECT 'Step 1: Current user and authentication' as step;
SELECT 
  auth.uid() as current_user_id,
  auth.role() as current_role;

-- Step 2: Check if user has admin role
SELECT 'Step 2: Check user roles' as step;
SELECT 
  p.name as user_name,
  ur.role,
  ur.created_at
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE p.id = auth.uid();

-- Step 3: Check if function exists and its definition
SELECT 'Step 3: Check function existence' as step;
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'mark_office_holiday_range';

-- Step 4: Test function with simple parameters
SELECT 'Step 4: Test function with simple parameters' as step;
DO $$
DECLARE
  test_result JSON;
  test_error TEXT;
BEGIN
  BEGIN
    SELECT public.mark_office_holiday_range(
      '2025-01-25'::DATE, 
      '2025-01-25'::DATE, 
      NULL
    ) INTO test_result;
    
    RAISE NOTICE 'Function executed successfully. Result: %', test_result;
  EXCEPTION
    WHEN OTHERS THEN
      test_error := SQLERRM;
      RAISE NOTICE 'Function failed with error: %', test_error;
  END;
END;
$$;

-- Step 5: Check current attendance records for test date
SELECT 'Step 5: Check current attendance records for test date' as step;
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
ORDER BY p.name;

-- Step 6: Check if there are any active employees
SELECT 'Step 6: Check active employees' as step;
SELECT 
  COUNT(*) as total_employees,
  COUNT(*) FILTER (WHERE is_active = true) as active_employees
FROM public.profiles;

-- Step 7: Test with specific user IDs
SELECT 'Step 7: Test with specific user IDs' as step;
DO $$
DECLARE
  test_user_ids UUID[];
  test_result JSON;
  test_error TEXT;
BEGIN
  -- Get first 2 active employees
  SELECT array_agg(p.id) INTO test_user_ids
  FROM public.profiles p
  WHERE COALESCE(p.is_active, TRUE) = TRUE
  LIMIT 2;
  
  RAISE NOTICE 'Testing with user IDs: %', test_user_ids;
  
  BEGIN
    SELECT public.mark_office_holiday_range(
      '2025-01-26'::DATE, 
      '2025-01-26'::DATE, 
      test_user_ids
    ) INTO test_result;
    
    RAISE NOTICE 'Function executed successfully. Result: %', test_result;
  EXCEPTION
    WHEN OTHERS THEN
      test_error := SQLERRM;
      RAISE NOTICE 'Function failed with error: %', test_error;
  END;
END;
$$;

-- Step 8: Check if records were created for the specific test
SELECT 'Step 8: Check records for specific test' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-01-26'::DATE
ORDER BY p.name;

-- Step 9: Check function permissions
SELECT 'Step 9: Check function permissions' as step;
SELECT 
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges 
WHERE routine_schema = 'public' 
  AND routine_name = 'mark_office_holiday_range';

-- Step 10: Test direct insert to see if we can write to unified_attendance
SELECT 'Step 10: Test direct insert capability' as step;
DO $$
DECLARE
  test_user_id UUID;
  insert_result TEXT;
BEGIN
  -- Get first active employee
  SELECT p.id INTO test_user_id
  FROM public.profiles p
  WHERE COALESCE(p.is_active, TRUE) = TRUE
  LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.unified_attendance (
        user_id, entry_date, device_info, source, status, manual_status, modification_reason
      ) VALUES (
        test_user_id,
        '2025-01-27'::DATE,
        'Debug Test',
        'manual',
        'holiday',
        'Office Holiday',
        'Debug test insert'
      );
      
      insert_result := 'SUCCESS: Direct insert worked';
      RAISE NOTICE '%', insert_result;
    EXCEPTION
      WHEN OTHERS THEN
        insert_result := 'FAILED: ' || SQLERRM;
        RAISE NOTICE '%', insert_result;
    END;
  ELSE
    RAISE NOTICE 'No active employees found for testing';
  END IF;
END;
$$;

-- Step 11: Check if the debug insert worked
SELECT 'Step 11: Check debug insert result' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-01-27'::DATE
ORDER BY p.name;