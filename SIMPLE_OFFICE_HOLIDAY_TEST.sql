-- Simple Office Holiday Test
-- This script tests the function step by step

-- Step 1: Check if we can call the function at all
SELECT 'Step 1: Testing function call' as step;

-- Try to call the function and see what happens
SELECT public.mark_office_holiday_range(
  '2025-01-28'::DATE, 
  '2025-01-28'::DATE, 
  NULL
) as function_result;

-- Step 2: Check what records exist for the test date
SELECT 'Step 2: Check records for test date' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-01-28'::DATE
ORDER BY p.name;

-- Step 3: Check if there are any records at all in unified_attendance
SELECT 'Step 3: Check total records in unified_attendance' as step;
SELECT 
  COUNT(*) as total_records,
  MIN(entry_date) as earliest_date,
  MAX(entry_date) as latest_date
FROM public.unified_attendance;

-- Step 4: Check if there are any active employees
SELECT 'Step 4: Check active employees' as step;
SELECT 
  p.id,
  p.name,
  p.is_active
FROM public.profiles p
WHERE COALESCE(p.is_active, TRUE) = TRUE
ORDER BY p.name;

-- Step 5: Test with a very simple approach - just insert one record manually
SELECT 'Step 5: Manual insert test' as step;
INSERT INTO public.unified_attendance (
  user_id, entry_date, device_info, source, status, manual_status, modification_reason
) 
SELECT 
  p.id,
  '2025-01-29'::DATE,
  'Manual Test',
  'manual',
  'holiday',
  'Office Holiday',
  'Manual test insert'
FROM public.profiles p
WHERE COALESCE(p.is_active, TRUE) = TRUE
LIMIT 1;

-- Step 6: Check if manual insert worked
SELECT 'Step 6: Check manual insert result' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-01-29'::DATE
ORDER BY p.name;

