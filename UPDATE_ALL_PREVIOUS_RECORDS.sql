-- UPDATE ALL PREVIOUS RECORDS WITH CORRECT LATE DETECTION
-- This script updates all historical attendance records with proper late detection

-- Step 1: Check how many records we have
SELECT 
  'Total Records to Update' as info,
  COUNT(*) as total_records,
  COUNT(CASE WHEN check_in_at IS NOT NULL THEN 1 END) as records_with_checkin,
  COUNT(CASE WHEN is_late = true THEN 1 END) as currently_late,
  COUNT(CASE WHEN is_late = false THEN 1 END) as currently_not_late
FROM public.unified_attendance;

-- Step 2: Update ALL records with the correct late detection function
UPDATE public.unified_attendance 
SET is_late = public.is_late_final(check_in_at),
    updated_at = NOW()
WHERE check_in_at IS NOT NULL;

-- Step 3: Check the results after update
SELECT 
  'Updated Results' as info,
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_late = true THEN 1 END) as now_late,
  COUNT(CASE WHEN is_late = false THEN 1 END) as now_not_late
FROM public.unified_attendance
WHERE check_in_at IS NOT NULL;

-- Step 4: Show some sample records with their new late status
SELECT 
  'Sample Updated Records' as info,
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
ORDER BY entry_date DESC, check_in_at DESC
LIMIT 20;

-- Step 5: Show records that are now marked as LATE
SELECT 
  'Records Now Marked as LATE' as info,
  employee_name,
  entry_date,
  check_in_at,
  CASE 
    WHEN check_in_at IS NOT NULL THEN 
      EXTRACT(HOUR FROM (check_in_at AT TIME ZONE 'Asia/Kolkata')) || ':' || 
      LPAD(EXTRACT(MINUTE FROM (check_in_at AT TIME ZONE 'Asia/Kolkata'))::TEXT, 2, '0')
    ELSE 'No check-in'
  END as checkin_time_ist
FROM public.unified_attendance 
WHERE check_in_at IS NOT NULL
  AND is_late = true
ORDER BY entry_date DESC, check_in_at DESC
LIMIT 20;

-- Step 6: Show summary by date
SELECT 
  'Summary by Date' as info,
  entry_date,
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_late = true THEN 1 END) as late_count,
  COUNT(CASE WHEN is_late = false THEN 1 END) as on_time_count,
  ROUND(
    (COUNT(CASE WHEN is_late = true THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
    2
  ) as late_percentage
FROM public.unified_attendance 
WHERE check_in_at IS NOT NULL
  AND entry_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY entry_date
ORDER BY entry_date DESC
LIMIT 10;

