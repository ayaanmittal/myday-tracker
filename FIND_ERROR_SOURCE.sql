-- Find the Exact Source of the Error
-- This script will identify what's causing the p.employee_category error

-- Step 1: Check for triggers on the leaves table
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'leaves'
  AND trigger_schema = 'public';

-- Step 2: Check for triggers on the leave_requests table
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'leave_requests'
  AND trigger_schema = 'public';

-- Step 3: Check for triggers on the profiles table
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'profiles'
  AND trigger_schema = 'public';

-- Step 4: Check for any functions that might be called by triggers
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition LIKE '%employee_category%'
  AND routine_definition NOT LIKE '%employee_category_id%';

-- Step 5: Check for any views that might be causing issues
SELECT 
  table_name,
  view_definition
FROM information_schema.views 
WHERE table_schema = 'public'
  AND view_definition LIKE '%employee_category%'
  AND view_definition NOT LIKE '%employee_category_id%';

-- Step 6: Check the exact error by looking at the function that's failing
SELECT 
  'Checking for auto_calculate_used_days function' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'auto_calculate_used_days') 
    THEN 'auto_calculate_used_days EXISTS - This might be the problem!'
    ELSE 'auto_calculate_used_days does not exist'
  END as status;

-- Step 7: Check for any other functions that might be problematic
SELECT 
  routine_name,
  'This function might be causing the error' as warning
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%leave%'
  AND routine_name NOT LIKE '%simple%';

