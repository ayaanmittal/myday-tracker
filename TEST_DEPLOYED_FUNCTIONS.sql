-- Test the deployed holiday functions
-- This script tests all the holiday functions to ensure they work correctly

-- Test 1: Check if functions exist
SELECT 
  'Function Existence Check' as test_type,
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%mark_office_holiday%'
ORDER BY routine_name;

-- Test 2: Test simple function with a small date range
SELECT 
  'Simple Function Test' as test_type,
  *
FROM public.mark_office_holiday_simple(
  '2025-11-15'::date,
  '2025-11-15'::date,
  NULL,
  'Test Holiday'
);

-- Test 3: Test main function (may fail due to auth)
SELECT 
  'Main Function Test' as test_type,
  *
FROM public.mark_office_holiday_range(
  '2025-11-16'::date,
  '2025-11-16'::date,
  NULL,
  'Test Holiday 2'
);

-- Test 4: Check results in tables
SELECT 
  'Company Holidays Check' as test_type,
  COUNT(*) as total_holidays,
  COUNT(CASE WHEN title = 'Test Holiday' THEN 1 END) as test_holidays
FROM public.company_holidays
WHERE holiday_date BETWEEN '2025-11-15' AND '2025-11-16';

-- Test 5: Check attendance records
SELECT 
  'Attendance Records Check' as test_type,
  COUNT(*) as total_records,
  COUNT(CASE WHEN manual_status = 'Office Holiday' THEN 1 END) as office_holidays
FROM public.unified_attendance
WHERE entry_date BETWEEN '2025-11-15' AND '2025-11-16';

-- Test 6: Check active employees
SELECT 
  'Active Employees Check' as test_type,
  COUNT(*) as active_employees
FROM public.profiles 
WHERE COALESCE(is_active, TRUE) = TRUE;
