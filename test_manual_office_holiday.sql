-- Manual test to set office holiday for specific dates
-- Run this AFTER applying the debug_office_holiday.sql

-- Test 1: Manually update records to Office Holiday status
UPDATE public.unified_attendance 
SET 
  manual_status = 'Office Holiday',
  status = 'Office Holiday',
  modification_reason = 'Manual test - Office Holiday override',
  manual_override_by = (SELECT id FROM auth.users LIMIT 1),
  manual_override_at = now(),
  updated_at = now()
WHERE entry_date BETWEEN '2025-10-20' AND '2025-10-21';

-- Check the results
SELECT 
  user_id,
  entry_date,
  status,
  manual_status,
  modification_reason,
  manual_override_at
FROM public.unified_attendance 
WHERE entry_date BETWEEN '2025-10-20' AND '2025-10-21'
ORDER BY entry_date, user_id;

-- Test 2: Try to call the function directly
SELECT public.mark_office_holiday_range('2025-10-20'::date, '2025-10-21'::date, null);
