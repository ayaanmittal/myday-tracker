-- Fix Auto-Mark Trigger Function
-- This script fixes the auto_mark_attendance_based_on_work_days trigger function to respect office holidays

-- Step 1: Check the current trigger function
SELECT 'Step 1: Current auto-mark trigger function' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'auto_mark_attendance_based_on_work_days';

-- Step 2: Create a fixed version that respects office holidays
CREATE OR REPLACE FUNCTION public.auto_mark_attendance_based_on_work_days_fixed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    work_days_config RECORD;
    day_of_week INTEGER;
    is_work_day BOOLEAN;
    is_office_holiday BOOLEAN := false;
BEGIN
    -- Check if this is an office holiday first
    IF NEW.manual_status = 'Office Holiday' THEN
        -- Don't override office holidays
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

-- Step 3: Update the original function to respect office holidays
CREATE OR REPLACE FUNCTION public.auto_mark_attendance_based_on_work_days()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    work_days_config RECORD;
    day_of_week INTEGER;
    is_work_day BOOLEAN;
    is_office_holiday BOOLEAN := false;
BEGIN
    -- Check if this is an office holiday first
    IF NEW.manual_status = 'Office Holiday' THEN
        -- Don't override office holidays
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

-- Step 4: Test the office holiday function again
SELECT 'Step 4: Test office holiday function after trigger fix' as step;
SELECT public.mark_office_holiday_range(
  '2025-02-12'::DATE, 
  '2025-02-12'::DATE, 
  NULL
) as result;

-- Step 5: Check if the fix worked
SELECT 'Step 5: Check if trigger fix worked' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-02-12'::DATE
ORDER BY p.name;

-- Step 6: If it worked, we can also test with a simple insert
SELECT 'Step 6: Test simple insert to verify trigger fix' as step;
INSERT INTO public.unified_attendance (
  user_id, 
  entry_date, 
  device_info, 
  source, 
  status, 
  manual_status, 
  modification_reason
) VALUES (
  (SELECT id FROM public.profiles WHERE name ILIKE '%dolly%' LIMIT 1),
  '2025-02-13'::DATE,
  'Test Office Holiday',
  'manual',
  'holiday',
  'Office Holiday',
  'Test office holiday with trigger fix'
);

-- Step 7: Check if the simple insert worked
SELECT 'Step 7: Check simple insert result' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-02-13'::DATE
ORDER BY p.name;



