-- Test Timezone Conversion for Late Detection
-- This script tests how UTC times convert to IST and whether late detection works correctly

-- Step 1: Check current timezone setting
SELECT 
  'Current Timezone Setting' as info,
  key,
  value
FROM public.settings 
WHERE key = 'timezone';

-- Step 2: Test timezone conversion for your sample data
SELECT 
  'Timezone Conversion Test' as info,
  'Ayaan 09:55 UTC' as employee,
  '2025-10-25 09:55:00+00'::timestamptz as utc_time,
  ('2025-10-25 09:55:00+00'::timestamptz AT TIME ZONE 'Asia/Kolkata') as ist_time,
  EXTRACT(HOUR FROM ('2025-10-25 09:55:00+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as ist_hour,
  EXTRACT(MINUTE FROM ('2025-10-25 09:55:00+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as ist_minute;

SELECT 
  'Timezone Conversion Test' as info,
  'Dolly 05:55 UTC' as employee,
  '2025-10-25 05:55:23.356+00'::timestamptz as utc_time,
  ('2025-10-25 05:55:23.356+00'::timestamptz AT TIME ZONE 'Asia/Kolkata') as ist_time,
  EXTRACT(HOUR FROM ('2025-10-25 05:55:23.356+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as ist_hour,
  EXTRACT(MINUTE FROM ('2025-10-25 05:55:23.356+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as ist_minute;

SELECT 
  'Timezone Conversion Test' as info,
  'Isha 05:54 UTC' as employee,
  '2025-10-25 05:54:49.991+00'::timestamptz as utc_time,
  ('2025-10-25 05:54:49.991+00'::timestamptz AT TIME ZONE 'Asia/Kolkata') as ist_time,
  EXTRACT(HOUR FROM ('2025-10-25 05:54:49.991+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as ist_hour,
  EXTRACT(MINUTE FROM ('2025-10-25 05:54:49.991+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as ist_minute;

SELECT 
  'Timezone Conversion Test' as info,
  'Vanshika 05:04 UTC' as employee,
  '2025-10-25 05:04:07.454+00'::timestamptz as utc_time,
  ('2025-10-25 05:04:07.454+00'::timestamptz AT TIME ZONE 'Asia/Kolkata') as ist_time,
  EXTRACT(HOUR FROM ('2025-10-25 05:04:07.454+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as ist_hour,
  EXTRACT(MINUTE FROM ('2025-10-25 05:04:07.454+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as ist_minute;

-- Step 3: Test what the late threshold time should be in UTC
-- If workday starts at 10:00 IST and late threshold is 30 minutes, then 10:30 IST is the cutoff
-- 10:30 IST = 05:00 UTC (IST is UTC+5:30)
SELECT 
  'Late Threshold Calculation' as info,
  '10:30 IST' as local_threshold,
  ('2025-10-25 10:30:00'::timestamp AT TIME ZONE 'Asia/Kolkata') as utc_threshold,
  'Any check-in after this UTC time should be marked as LATE' as explanation;

-- Step 4: Test the timezone-aware late detection function
SELECT 
  'Late Detection Test' as info,
  'Ayaan 09:55 UTC (15:25 IST)' as test_case,
  public.is_checkin_late_with_timezone('2025-10-25 09:55:00+00'::timestamptz) as is_late,
  'Should be TRUE (15:25 IST > 10:30 IST)' as expected;

SELECT 
  'Late Detection Test' as info,
  'Dolly 05:55 UTC (11:25 IST)' as test_case,
  public.is_checkin_late_with_timezone('2025-10-25 05:55:23.356+00'::timestamptz) as is_late,
  'Should be TRUE (11:25 IST > 10:30 IST)' as expected;

SELECT 
  'Late Detection Test' as info,
  'Isha 05:54 UTC (11:24 IST)' as test_case,
  public.is_checkin_late_with_timezone('2025-10-25 05:54:49.991+00'::timestamptz) as is_late,
  'Should be TRUE (11:24 IST > 10:30 IST)' as expected;

SELECT 
  'Late Detection Test' as info,
  'Vanshika 05:04 UTC (10:34 IST)' as test_case,
  public.is_checkin_late_with_timezone('2025-10-25 05:04:07.454+00'::timestamptz) as is_late,
  'Should be TRUE (10:34 IST > 10:30 IST)' as expected;

-- Step 5: Test with an early check-in (should be NOT late)
SELECT 
  'Late Detection Test' as info,
  'Early 04:00 UTC (09:30 IST)' as test_case,
  public.is_checkin_late_with_timezone('2025-10-25 04:00:00+00'::timestamptz) as is_late,
  'Should be FALSE (09:30 IST < 10:30 IST)' as expected;
