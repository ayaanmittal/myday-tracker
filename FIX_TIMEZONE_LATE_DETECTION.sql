-- Fix Timezone Issues in Late Detection
-- The problem is that check-in times are stored in UTC but the late detection logic
-- needs to work with the local timezone (Asia/Kolkata)

-- Step 1: Check current timezone settings
SELECT 
  'Current Timezone Settings' as info,
  key,
  value
FROM public.settings 
WHERE key = 'timezone';

-- Step 2: Create a timezone-aware late detection function
CREATE OR REPLACE FUNCTION public.is_checkin_late_with_timezone(
  checkin_time TIMESTAMPTZ,
  workday_start_time TEXT DEFAULT NULL,
  late_threshold_minutes INTEGER DEFAULT NULL,
  timezone_name TEXT DEFAULT 'Asia/Kolkata'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  checkin_date DATE;
  expected_start_time TIMESTAMPTZ;
  late_threshold_time TIMESTAMPTZ;
  v_workday_start TEXT;
  v_late_threshold INTEGER;
  v_timezone TEXT;
  checkin_local_time TIMESTAMPTZ;
  workday_start_local TIMESTAMPTZ;
BEGIN
  -- Get timezone from settings
  SELECT value INTO v_timezone
  FROM public.settings 
  WHERE key = 'timezone' 
  LIMIT 1;
  v_timezone := COALESCE(v_timezone, timezone_name);
  
  -- Get settings if not provided
  IF workday_start_time IS NULL THEN
    SELECT value INTO v_workday_start
    FROM public.settings 
    WHERE key = 'workday_start_time' 
    LIMIT 1;
    v_workday_start := COALESCE(v_workday_start, '10:30');
  ELSE
    v_workday_start := workday_start_time;
  END IF;
  
  IF late_threshold_minutes IS NULL THEN
    SELECT value::INTEGER INTO v_late_threshold
    FROM public.settings 
    WHERE key = 'late_threshold_minutes' 
    LIMIT 1;
    v_late_threshold := COALESCE(v_late_threshold, 15);
  ELSE
    v_late_threshold := late_threshold_minutes;
  END IF;
  
  -- Convert checkin_time to local timezone
  checkin_local_time := checkin_time AT TIME ZONE v_timezone;
  checkin_date := checkin_local_time::DATE;
  
  -- Create expected start time for that date in local timezone
  workday_start_local := (checkin_date || ' ' || v_workday_start)::TIMESTAMPTZ AT TIME ZONE v_timezone;
  
  -- Calculate late threshold time
  late_threshold_time := workday_start_local + (v_late_threshold || ' minutes')::INTERVAL;
  
  -- Debug output
  RAISE NOTICE 'Checkin UTC: %, Checkin Local: %, Workday Start: %, Late Threshold: % minutes, Late Threshold Time: %', 
    checkin_time, checkin_local_time, v_workday_start, v_late_threshold, late_threshold_time;
  
  -- Return true if checkin_time is after the late threshold
  RETURN checkin_time > late_threshold_time;
END;
$$;

-- Step 3: Update the get_late_status_for_checkin function to use timezone-aware logic
CREATE OR REPLACE FUNCTION public.get_late_status_for_checkin(
  checkin_time TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Use the timezone-aware late detection function
  RETURN public.is_checkin_late_with_timezone(checkin_time);
END;
$$;

-- Step 4: Test the timezone-aware function with your sample data
SELECT 
  'Timezone-Aware Test' as test_type,
  'Ayaan 09:55 UTC' as test_case,
  public.is_checkin_late_with_timezone('2025-10-25 09:55:00+00'::timestamptz) as is_late,
  'Should be TRUE (15:25 IST > 10:30 IST)' as expected;

SELECT 
  'Timezone-Aware Test' as test_type,
  'Dolly 05:55 UTC' as test_case,
  public.is_checkin_late_with_timezone('2025-10-25 05:55:23.356+00'::timestamptz) as is_late,
  'Should be TRUE (11:25 IST > 10:30 IST)' as expected;

SELECT 
  'Timezone-Aware Test' as test_type,
  'Isha 05:54 UTC' as test_case,
  public.is_checkin_late_with_timezone('2025-10-25 05:54:49.991+00'::timestamptz) as is_late,
  'Should be TRUE (11:24 IST > 10:30 IST)' as expected;

SELECT 
  'Timezone-Aware Test' as test_type,
  'Vanshika 05:04 UTC' as test_case,
  public.is_checkin_late_with_timezone('2025-10-25 05:04:07.454+00'::timestamptz) as is_late,
  'Should be TRUE (10:34 IST > 10:30 IST)' as expected;

-- Step 5: Test with a clearly early check-in (should be NOT late)
SELECT 
  'Timezone-Aware Test' as test_type,
  'Early check-in 04:00 UTC' as test_case,
  public.is_checkin_late_with_timezone('2025-10-25 04:00:00+00'::timestamptz) as is_late,
  'Should be FALSE (09:30 IST < 10:30 IST)' as expected;

-- Step 6: Test with a clearly late check-in (should be LATE)
SELECT 
  'Timezone-Aware Test' as test_type,
  'Late check-in 06:00 UTC' as test_case,
  public.is_checkin_late_with_timezone('2025-10-25 06:00:00+00'::timestamptz) as is_late,
  'Should be TRUE (11:30 IST > 10:30 IST)' as expected;

-- Step 7: Update existing records with timezone-aware late detection
CREATE OR REPLACE FUNCTION public.update_late_status_with_timezone()
RETURNS TABLE(
  updated_count INTEGER,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  -- Update all unified_attendance records with correct late status using timezone-aware logic
  UPDATE public.unified_attendance 
  SET is_late = public.get_late_status_for_checkin(check_in_at),
      updated_at = NOW()
  WHERE check_in_at IS NOT NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  updated_count := v_updated_count;
  message := 'Updated ' || v_updated_count || ' attendance records with timezone-aware late status';
  RETURN NEXT;
END;
$$;

-- Step 8: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_checkin_late_with_timezone(TIMESTAMPTZ, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_late_status_with_timezone() TO authenticated;

-- Step 9: Run the timezone-aware update
SELECT * FROM public.update_late_status_with_timezone();



