-- Debug Holiday Calculation
-- This script helps identify what's being counted as holiday days

-- Step 1: Check what records exist for February 2025
SELECT 'Step 1: Check all attendance records for February 2025' as step;
SELECT 
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name,
  EXTRACT(DOW FROM ua.entry_date) as day_of_week,
  CASE EXTRACT(DOW FROM ua.entry_date)
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
  END as day_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date BETWEEN '2025-02-01' AND '2025-02-28'
  AND p.name ILIKE '%dolly%'
ORDER BY ua.entry_date;

-- Step 2: Count different types of records
SELECT 'Step 2: Count different types of records' as step;
SELECT 
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
  COUNT(*) FILTER (WHERE status = 'holiday') as holiday_status_count,
  COUNT(*) FILTER (WHERE manual_status = 'Office Holiday') as office_holiday_count,
  COUNT(*) FILTER (WHERE status = 'holiday' OR manual_status = 'Office Holiday') as total_holiday_count,
  COUNT(*) FILTER (WHERE EXTRACT(DOW FROM entry_date) = 0) as sunday_count
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date BETWEEN '2025-02-01' AND '2025-02-28'
  AND p.name ILIKE '%dolly%';

-- Step 3: Check work days configuration for Dolly
SELECT 'Step 3: Check work days configuration for Dolly' as step;
SELECT 
  p.name,
  ewd.monday,
  ewd.tuesday,
  ewd.wednesday,
  ewd.thursday,
  ewd.friday,
  ewd.saturday,
  ewd.sunday
FROM public.profiles p
LEFT JOIN public.employee_work_days ewd ON ewd.user_id = p.id
WHERE p.name ILIKE '%dolly%';

-- Step 4: Check what the function is actually returning
SELECT 'Step 4: Test the function with Dolly' as step;
SELECT * FROM get_work_history_stats(
  (SELECT id FROM public.profiles WHERE name ILIKE '%dolly%' LIMIT 1),
  '2025-02-01'::DATE,
  '2025-02-28'::DATE
);

-- Step 5: Check if there are any records with status = 'holiday' that shouldn't be there
SELECT 'Step 5: Check records with status = holiday' as step;
SELECT 
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name,
  EXTRACT(DOW FROM ua.entry_date) as day_of_week,
  CASE EXTRACT(DOW FROM ua.entry_date)
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
  END as day_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date BETWEEN '2025-02-01' AND '2025-02-28'
  AND p.name ILIKE '%dolly%'
  AND ua.status = 'holiday'
ORDER BY ua.entry_date;

-- Step 6: Check if there are any records with manual_status = 'Office Holiday'
SELECT 'Step 6: Check records with manual_status = Office Holiday' as step;
SELECT 
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name,
  EXTRACT(DOW FROM ua.entry_date) as day_of_week,
  CASE EXTRACT(DOW FROM ua.entry_date)
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
  END as day_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date BETWEEN '2025-02-01' AND '2025-02-28'
  AND p.name ILIKE '%dolly%'
  AND ua.manual_status = 'Office Holiday'
ORDER BY ua.entry_date;

