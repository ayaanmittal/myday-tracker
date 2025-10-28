-- Fix Trigger Function Completely
-- This script completely fixes the auto_mark_attendance_based_on_work_days trigger function

-- Step 1: Check the current trigger function
SELECT 'Step 1: Current trigger function' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'auto_mark_attendance_based_on_work_days';

-- Step 2: Completely replace the trigger function with a fixed version
CREATE OR REPLACE FUNCTION public.auto_mark_attendance_based_on_work_days()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    work_days_config RECORD;
    day_of_week INTEGER;
    is_work_day BOOLEAN;
BEGIN
    -- CRITICAL: Check for office holidays FIRST and don't override them
    IF NEW.manual_status = 'Office Holiday' THEN
        -- Force status to holiday for office holidays
        NEW.status := 'holiday';
        RETURN NEW;
    END IF;
    
    -- Get work days configuration for the user
    SELECT * INTO work_days_config FROM get_employee_work_days(NEW.user_id);
    
    -- Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    day_of_week := EXTRACT(DOW FROM NEW.entry_date);
    
    -- Determine if this is a work day based on configuration
    is_work_day := CASE day_of_week
        WHEN 0 THEN work_days_config.sunday
        WHEN 1 THEN work_days_config.monday
        WHEN 2 THEN work_days_config.tuesday
        WHEN 3 THEN work_days_config.wednesday
        WHEN 4 THEN work_days_config.thursday
        WHEN 5 THEN work_days_config.friday
        WHEN 6 THEN work_days_config.saturday
    END;
    
    -- Only auto-mark if this is a new record or status is being changed
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
        -- If it's a work day but no check-in/check-out, mark as absent
        -- BUT ONLY if it's not an office holiday
        IF is_work_day AND (NEW.check_in_at IS NULL AND NEW.check_out_at IS NULL) AND NEW.manual_status != 'Office Holiday' THEN
            NEW.status := 'absent';
            NEW.modification_reason := COALESCE(NEW.modification_reason, '') || '; Auto-marked as absent (work day, no attendance)';
        -- If it's not a work day, mark as holiday
        ELSIF NOT is_work_day THEN
            NEW.status := 'holiday';
            NEW.modification_reason := COALESCE(NEW.modification_reason, '') || '; Auto-marked as holiday (non-work day)';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Step 3: Test the fixed trigger by updating the problematic records
SELECT 'Step 3: Fix existing office holiday records' as step;
UPDATE public.unified_attendance 
SET 
    status = 'holiday',
    modification_reason = 'Fixed office holiday status'
WHERE manual_status = 'Office Holiday' 
  AND status = 'absent'
  AND entry_date BETWEEN '2025-02-01' AND '2025-02-28';

-- Step 4: Check the updated records
SELECT 'Step 4: Check updated records' as step;
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

-- Step 5: Test the function again
SELECT 'Step 5: Test the function again' as step;
SELECT * FROM get_work_history_stats(
  (SELECT id FROM public.profiles WHERE name ILIKE '%dolly%' LIMIT 1),
  '2025-02-01'::DATE,
  '2025-02-28'::DATE
);

-- Step 6: Test with a new office holiday to make sure the trigger works
SELECT 'Step 6: Test with new office holiday' as step;
SELECT public.mark_office_holiday_range(
  '2025-02-14'::DATE, 
  '2025-02-14'::DATE, 
  (SELECT array_agg(id) FROM public.profiles WHERE name ILIKE '%dolly%')
) as result;

-- Step 7: Check if the new office holiday was created correctly
SELECT 'Step 7: Check new office holiday' as step;
SELECT 
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-02-14'
  AND p.name ILIKE '%dolly%';

