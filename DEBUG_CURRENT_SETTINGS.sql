-- Debug current settings for late detection
-- This script checks what settings are currently configured

-- Check current settings
SELECT 
  'Current Settings' as info,
  key,
  value,
  description
FROM public.settings 
WHERE key IN ('workday_start_time', 'late_threshold_minutes')
ORDER BY key;

-- Test the is_checkin_late function with your settings
-- Workday start: 10:00, Late threshold: 30 minutes
-- So late threshold time should be 10:30

-- Test cases:
-- 1. Check-in at 09:30 (should be NOT late)
-- 2. Check-in at 10:15 (should be NOT late) 
-- 3. Check-in at 10:30 (should be NOT late - exactly at threshold)
-- 4. Check-in at 10:31 (should be LATE)
-- 5. Check-in at 11:00 (should be LATE)

SELECT 
  'Test Case 1: 09:30' as test_case,
  public.is_checkin_late('2025-01-15 09:30:00+05:30'::timestamptz) as is_late,
  'Should be FALSE' as expected;

SELECT 
  'Test Case 2: 10:15' as test_case,
  public.is_checkin_late('2025-01-15 10:15:00+05:30'::timestamptz) as is_late,
  'Should be FALSE' as expected;

SELECT 
  'Test Case 3: 10:30' as test_case,
  public.is_checkin_late('2025-01-15 10:30:00+05:30'::timestamptz) as is_late,
  'Should be FALSE' as expected;

SELECT 
  'Test Case 4: 10:31' as test_case,
  public.is_checkin_late('2025-01-15 10:31:00+05:30'::timestamptz) as is_late,
  'Should be TRUE' as expected;

SELECT 
  'Test Case 5: 11:00' as test_case,
  public.is_checkin_late('2025-01-15 11:00:00+05:30'::timestamptz) as is_late,
  'Should be TRUE' as expected;

-- Check if there are any attendance records that should be marked as late
SELECT 
  'Current Late Records' as info,
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_late = true THEN 1 END) as late_records,
  COUNT(CASE WHEN is_late = false THEN 1 END) as not_late_records
FROM public.unified_attendance 
WHERE check_in_at IS NOT NULL
  AND entry_date >= CURRENT_DATE - INTERVAL '7 days';

-- Show some sample records with their check-in times and late status
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
  END as checkin_time_formatted
FROM public.unified_attendance 
WHERE check_in_at IS NOT NULL
  AND entry_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY entry_date DESC, check_in_at DESC
LIMIT 10;

