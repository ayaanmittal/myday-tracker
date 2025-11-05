-- Check for Remaining References
-- This script checks for any remaining references to the old employee_category column

-- Step 1: Check for any functions that might still reference the old column
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition LIKE '%employee_category%'
  AND routine_definition NOT LIKE '%employee_category_id%';

-- Step 2: Check for any triggers that might reference the old column
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
  AND action_statement LIKE '%employee_category%'
  AND action_statement NOT LIKE '%employee_category_id%';

-- Step 3: Check for any views that might reference the old column
SELECT 
  table_name,
  view_definition
FROM information_schema.views 
WHERE table_schema = 'public'
  AND view_definition LIKE '%employee_category%'
  AND view_definition NOT LIKE '%employee_category_id%';

-- Step 4: List all functions in the public schema
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Step 5: Check if our clean functions exist
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'approve_leave_request_simple') 
    THEN 'approve_leave_request_simple exists'
    ELSE 'approve_leave_request_simple MISSING'
  END as approve_function_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'reject_leave_request_simple') 
    THEN 'reject_leave_request_simple exists'
    ELSE 'reject_leave_request_simple MISSING'
  END as reject_function_status;



