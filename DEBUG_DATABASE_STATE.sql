-- Debug Database State
-- This script will help identify what's causing the employee_category error

-- Step 1: Check all functions in the database
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Step 2: Check all triggers
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY trigger_name;

-- Step 3: Check all views
SELECT 
  table_name,
  view_definition
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Step 4: Check for any remaining references to employee_category
SELECT 
  'Functions with employee_category' as type,
  routine_name as name,
  'Function' as object_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition LIKE '%employee_category%'
  AND routine_definition NOT LIKE '%employee_category_id%'

UNION ALL

SELECT 
  'Triggers with employee_category' as type,
  trigger_name as name,
  'Trigger' as object_type
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
  AND action_statement LIKE '%employee_category%'
  AND action_statement NOT LIKE '%employee_category_id%'

UNION ALL

SELECT 
  'Views with employee_category' as type,
  table_name as name,
  'View' as object_type
FROM information_schema.views 
WHERE table_schema = 'public'
  AND view_definition LIKE '%employee_category%'
  AND view_definition NOT LIKE '%employee_category_id%';

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
