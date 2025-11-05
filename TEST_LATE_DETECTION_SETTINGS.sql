-- Test Late Detection with Current Settings
-- This script tests the late detection logic with your specific settings

-- Step 1: Check current settings
SELECT 
  'Current Settings' as info,
  key,
  value,
  description
FROM public.settings 
WHERE key IN ('workday_start_time', 'late_threshold_minutes')
ORDER BY key;

-- Step 2: Test the function with your settings
-- Your settings: workday_start_time = '10:00', late_threshold_minutes = 30
-- So late threshold time should be 10:30

-- Test with explicit parameters
SELECT 
  'Test with explicit parameters' as test_type,
  '10:00' as workday_start,
  30 as late_threshold_minutes,
  public.is_checkin_late('2025-01-15 09:30:00+05:30'::timestamptz, '10:00', 30) as test_0930,
  public.is_checkin_late('2025-01-15 10:15:00+05:30'::timestamptz, '10:00', 30) as test_1015,
  public.is_checkin_late('2025-01-15 10:30:00+05:30'::timestamptz, '10:00', 30) as test_1030,
  public.is_checkin_late('2025-01-15 10:31:00+05:30'::timestamptz, '10:00', 30) as test_1031,
  public.is_checkin_late('2025-01-15 11:00:00+05:30'::timestamptz, '10:00', 30) as test_1100;

-- Step 3: Test with settings from database
SELECT 
  'Test with database settings' as test_type,
  public.is_checkin_late('2025-01-15 09:30:00+05:30'::timestamptz) as test_0930,
  public.is_checkin_late('2025-01-15 10:15:00+05:30'::timestamptz) as test_1015,
  public.is_checkin_late('2025-01-15 10:30:00+05:30'::timestamptz) as test_1030,
  public.is_checkin_late('2025-01-15 10:31:00+05:30'::timestamptz) as test_1031,
  public.is_checkin_late('2025-01-15 11:00:00+05:30'::timestamptz) as test_1100;

-- Step 4: Test the get_late_status_for_checkin function
SELECT 
  'Test get_late_status_for_checkin function' as test_type,
  public.get_late_status_for_checkin('2025-01-15 09:30:00+05:30'::timestamptz) as test_0930,
  public.get_late_status_for_checkin('2025-01-15 10:15:00+05:30'::timestamptz) as test_1015,
  public.get_late_status_for_checkin('2025-01-15 10:30:00+05:30'::timestamptz) as test_1030,
  public.get_late_status_for_checkin('2025-01-15 10:31:00+05:30'::timestamptz) as test_1031,
  public.get_late_status_for_checkin('2025-01-15 11:00:00+05:30'::timestamptz) as test_1100;

-- Step 5: Check current attendance records
SELECT 
  'Current Attendance Records' as info,
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_late = true THEN 1 END) as late_records,
  COUNT(CASE WHEN is_late = false THEN 1 END) as not_late_records,
  COUNT(CASE WHEN is_late IS NULL THEN 1 END) as null_late_records
FROM public.unified_attendance 
WHERE check_in_at IS NOT NULL
  AND entry_date >= CURRENT_DATE - INTERVAL '7 days';

-- Step 6: Show some sample records
SELECT 
  'Sample Records' as info,
  employee_name,
  entry_date,
  check_in_at,
  is_late,
  CASE 
    WHEN check_in_at IS NOT NULL THEN 
      EXTRACT(HOUR FROM check_in_at) || ':' || 
      LPAD(EXTRACT(MINUTE FROM check_in_at)::TEXT, 2, '0')
    ELSE 'No check-in'
  END as checkin_time_formatted,
  -- Calculate what the late status should be
  public.get_late_status_for_checkin(check_in_at) as should_be_late
FROM public.unified_attendance 
WHERE check_in_at IS NOT NULL
  AND entry_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY entry_date DESC, check_in_at DESC
LIMIT 10;



