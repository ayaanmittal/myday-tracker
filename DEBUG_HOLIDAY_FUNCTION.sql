-- Debug script to test the mark_office_holiday_range function
-- This will help identify why it's returning 0 days

-- 1. Test the function with a specific date range
SELECT 
  'Function Test' as test_type,
  *
FROM public.mark_office_holiday_range_complete(
  '2025-11-15'::date,
  '2025-11-17'::date,
  NULL,
  'Test Holiday'
);

-- 2. Check if there are any active employees
SELECT 
  'Active Employees' as test_type,
  COUNT(*) as employee_count,
  array_agg(id) as employee_ids
FROM public.profiles 
WHERE COALESCE(is_active, TRUE) = TRUE;

-- 3. Check if there are any existing attendance records for the test dates
SELECT 
  'Existing Attendance' as test_type,
  COUNT(*) as existing_records,
  COUNT(CASE WHEN manual_status = 'Office Holiday' THEN 1 END) as office_holidays
FROM public.unified_attendance 
WHERE entry_date BETWEEN '2025-11-15' AND '2025-11-17';

-- 4. Check company_holidays table
SELECT 
  'Company Holidays' as test_type,
  COUNT(*) as total_holidays
FROM public.company_holidays;

-- 5. Test with a single employee
SELECT 
  'Single Employee Test' as test_type,
  *
FROM public.mark_office_holiday_range_complete(
  '2025-11-15'::date,
  '2025-11-15'::date,
  ARRAY[(SELECT id FROM public.profiles WHERE COALESCE(is_active, TRUE) = TRUE LIMIT 1)],
  'Single Day Test'
);

-- 6. Check the function directly without wrapper
SELECT 
  'Direct Function Test' as test_type,
  *
FROM public.mark_office_holiday_range(
  '2025-11-15'::date,
  '2025-11-17'::date,
  NULL
);
