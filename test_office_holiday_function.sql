-- Test script to verify the mark_office_holiday_range function is working
-- This script will help debug why records are not updating

-- Step 1: Check if the function exists
SELECT 'Checking if mark_office_holiday_range function exists:' as step;
SELECT 
  routine_name, 
  routine_type, 
  data_type as return_type
FROM information_schema.routines 
WHERE routine_name = 'mark_office_holiday_range' 
  AND routine_schema = 'public';

-- Step 2: Check current user permissions
SELECT 'Checking current user permissions:' as step;
SELECT 
  p.name,
  ur.role,
  p.is_active
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE p.id = auth.uid();

-- Step 3: Check if there are active employees
SELECT 'Checking active employees:' as step;
SELECT 
  COUNT(*) as total_employees,
  COUNT(*) FILTER (WHERE is_active = true) as active_employees
FROM public.profiles;

-- Step 4: Check current attendance records for a test date
SELECT 'Checking current attendance records for test date:' as step;
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

-- Step 5: Test the function with a small date range
SELECT 'Testing mark_office_holiday_range function:' as step;
SELECT public.mark_office_holiday_range(
  '2025-01-25'::DATE, 
  '2025-01-25'::DATE, 
  NULL
) as result;

-- Step 6: Check if records were updated after function call
SELECT 'Checking attendance records after function call:' as step;
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
ORDER BY p.name;

-- Step 7: Check for any errors in the function
SELECT 'Checking for any function errors:' as step;
-- This will show if there are any syntax errors or issues
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'mark_office_holiday_range' 
  AND routine_schema = 'public';



