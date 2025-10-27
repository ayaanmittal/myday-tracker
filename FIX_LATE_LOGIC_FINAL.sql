-- FINAL FIX for Late Detection Logic
-- The issue is in the comparison logic - we need to compare IST times properly

-- Step 1: Check current settings
SELECT 
  'Current Settings' as info,
  key,
  value
FROM public.settings 
WHERE key IN ('workday_start_time', 'late_threshold_minutes', 'timezone')
ORDER BY key;

-- Step 2: Create the corrected late detection function
CREATE OR REPLACE FUNCTION public.is_late_corrected(
  checkin_time TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_workday_start TEXT;
  v_late_threshold INTEGER;
  v_timezone TEXT;
  checkin_ist TIMESTAMPTZ;
  workday_start_ist TIMESTAMPTZ;
  late_threshold_ist TIMESTAMPTZ;
  checkin_date DATE;
  checkin_hour INTEGER;
  checkin_minute INTEGER;
  late_hour INTEGER;
  late_minute INTEGER;
BEGIN
  -- Get settings
  SELECT value INTO v_workday_start FROM public.settings WHERE key = 'workday_start_time' LIMIT 1;
  SELECT value::INTEGER INTO v_late_threshold FROM public.settings WHERE key = 'late_threshold_minutes' LIMIT 1;
  SELECT value INTO v_timezone FROM public.settings WHERE key = 'timezone' LIMIT 1;
  
  -- Use defaults if not found
  v_workday_start := COALESCE(v_workday_start, '10:00');
  v_late_threshold := COALESCE(v_late_threshold, 30);
  v_timezone := COALESCE(v_timezone, 'Asia/Kolkata');
  
  -- Convert checkin time to IST
  checkin_ist := checkin_time AT TIME ZONE v_timezone;
  checkin_date := checkin_ist::DATE;
  
  -- Extract hour and minute from workday start time
  late_hour := EXTRACT(HOUR FROM (v_workday_start || ':00')::TIME) + (v_late_threshold / 60);
  late_minute := EXTRACT(MINUTE FROM (v_workday_start || ':00')::TIME) + (v_late_threshold % 60);
  
  -- Handle minute overflow
  IF late_minute >= 60 THEN
    late_hour := late_hour + 1;
    late_minute := late_minute - 60;
  END IF;
  
  -- Extract checkin hour and minute in IST
  checkin_hour := EXTRACT(HOUR FROM checkin_ist);
  checkin_minute := EXTRACT(MINUTE FROM checkin_ist);
  
  -- Debug output
  RAISE NOTICE 'Checkin UTC: %, Checkin IST: %, Checkin Time: %:%, Late Threshold: %:%, Is Late: %', 
    checkin_time, checkin_ist, checkin_hour, checkin_minute, late_hour, late_minute,
    (checkin_hour > late_hour OR (checkin_hour = late_hour AND checkin_minute > late_minute));
  
  -- Return true if checkin time is after the late threshold
  RETURN (checkin_hour > late_hour OR (checkin_hour = late_hour AND checkin_minute > late_minute));
END;
$$;

-- Step 3: Test the corrected function with your sample data
SELECT 
  'Test Ayaan 15:25 IST' as test_case,
  public.is_late_corrected('2025-10-25 09:55:00+00'::timestamptz) as is_late,
  'Should be TRUE (15:25 IST > 10:30 IST)' as expected;

SELECT 
  'Test Dolly 11:25 IST' as test_case,
  public.is_late_corrected('2025-10-25 05:55:23.356+00'::timestamptz) as is_late,
  'Should be TRUE (11:25 IST > 10:30 IST)' as expected;

SELECT 
  'Test Isha 11:24 IST' as test_case,
  public.is_late_corrected('2025-10-25 05:54:49.991+00'::timestamptz) as is_late,
  'Should be TRUE (11:24 IST > 10:30 IST)' as expected;

SELECT 
  'Test Vanshika 10:34 IST' as test_case,
  public.is_late_corrected('2025-10-25 05:04:07.454+00'::timestamptz) as is_late,
  'Should be TRUE (10:34 IST > 10:30 IST)' as expected;

-- Step 4: Test with an early check-in (should be NOT late)
SELECT 
  'Test Early 09:30 IST' as test_case,
  public.is_late_corrected('2025-10-25 04:00:00+00'::timestamptz) as is_late,
  'Should be FALSE (09:30 IST < 10:30 IST)' as expected;

-- Step 5: Update existing records with the corrected function
UPDATE public.unified_attendance 
SET is_late = public.is_late_corrected(check_in_at),
    updated_at = NOW()
WHERE check_in_at IS NOT NULL
  AND entry_date >= CURRENT_DATE - INTERVAL '7 days';

-- Step 6: Check the results
SELECT 
  'Updated Records' as info,
  employee_name,
  entry_date,
  check_in_at,
  is_late,
  CASE 
    WHEN check_in_at IS NOT NULL THEN 
      EXTRACT(HOUR FROM (check_in_at AT TIME ZONE 'Asia/Kolkata')) || ':' || 
      LPAD(EXTRACT(MINUTE FROM (check_in_at AT TIME ZONE 'Asia/Kolkata'))::TEXT, 2, '0')
    ELSE 'No check-in'
  END as checkin_time_ist,
  CASE 
    WHEN is_late THEN 'LATE'
    ELSE 'ON TIME'
  END as status
FROM public.unified_attendance 
WHERE check_in_at IS NOT NULL
  AND entry_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY entry_date DESC, check_in_at DESC
LIMIT 10;

-- Step 7: Grant permissions
GRANT EXECUTE ON FUNCTION public.is_late_corrected(TIMESTAMPTZ) TO authenticated;
