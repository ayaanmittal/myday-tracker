-- Auto-mark attendance status based on work days configuration
-- Run this in Supabase SQL Editor

-- Step 1: Create function to auto-mark attendance based on work days
CREATE OR REPLACE FUNCTION auto_mark_attendance_based_on_work_days()
RETURNS TRIGGER AS $$
DECLARE
    work_days_config RECORD;
    day_of_week INTEGER;
    is_work_day BOOLEAN;
BEGIN
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
        IF is_work_day AND (NEW.check_in_at IS NULL AND NEW.check_out_at IS NULL) THEN
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
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger to auto-mark attendance based on work days
DROP TRIGGER IF EXISTS trigger_auto_mark_attendance_work_days ON public.unified_attendance;
CREATE TRIGGER trigger_auto_mark_attendance_work_days
  BEFORE INSERT OR UPDATE ON public.unified_attendance
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_attendance_based_on_work_days();

-- Step 3: Process existing records for the last 30 days
UPDATE public.unified_attendance 
SET 
    status = CASE 
        WHEN (
            SELECT CASE EXTRACT(DOW FROM entry_date)
                WHEN 0 THEN (SELECT sunday FROM get_employee_work_days(user_id))
                WHEN 1 THEN (SELECT monday FROM get_employee_work_days(user_id))
                WHEN 2 THEN (SELECT tuesday FROM get_employee_work_days(user_id))
                WHEN 3 THEN (SELECT wednesday FROM get_employee_work_days(user_id))
                WHEN 4 THEN (SELECT thursday FROM get_employee_work_days(user_id))
                WHEN 5 THEN (SELECT friday FROM get_employee_work_days(user_id))
                WHEN 6 THEN (SELECT saturday FROM get_employee_work_days(user_id))
            END
        ) THEN 
            CASE 
                WHEN check_in_at IS NULL AND check_out_at IS NULL THEN 'absent'
                ELSE status
            END
        ELSE 'holiday'
    END,
    modification_reason = COALESCE(modification_reason, '') || '; Auto-marked based on work days',
    updated_at = NOW()
WHERE 
    entry_date >= CURRENT_DATE - INTERVAL '30 days'
    AND entry_date <= CURRENT_DATE
    AND status NOT IN ('holiday', 'absent') -- Don't update already marked records
    AND (
        -- Only update if work day status doesn't match current status
        (CASE EXTRACT(DOW FROM entry_date)
            WHEN 0 THEN (SELECT sunday FROM get_employee_work_days(user_id))
            WHEN 1 THEN (SELECT monday FROM get_employee_work_days(user_id))
            WHEN 2 THEN (SELECT tuesday FROM get_employee_work_days(user_id))
            WHEN 3 THEN (SELECT wednesday FROM get_employee_work_days(user_id))
            WHEN 4 THEN (SELECT thursday FROM get_employee_work_days(user_id))
            WHEN 5 THEN (SELECT friday FROM get_employee_work_days(user_id))
            WHEN 6 THEN (SELECT saturday FROM get_employee_work_days(user_id))
        END) = false -- Non-work day should be holiday
        OR (
            (CASE EXTRACT(DOW FROM entry_date)
                WHEN 0 THEN (SELECT sunday FROM get_employee_work_days(user_id))
                WHEN 1 THEN (SELECT monday FROM get_employee_work_days(user_id))
                WHEN 2 THEN (SELECT tuesday FROM get_employee_work_days(user_id))
                WHEN 3 THEN (SELECT wednesday FROM get_employee_work_days(user_id))
                WHEN 4 THEN (SELECT thursday FROM get_employee_work_days(user_id))
                WHEN 5 THEN (SELECT friday FROM get_employee_work_days(user_id))
                WHEN 6 THEN (SELECT saturday FROM get_employee_work_days(user_id))
            END) = true -- Work day
            AND check_in_at IS NULL 
            AND check_out_at IS NULL -- No attendance should be absent
        )
    );

-- Step 4: Show summary
SELECT 
    'Work days auto-marking system activated!' as message,
    COUNT(*) as processed_records
FROM public.unified_attendance
WHERE modification_reason LIKE '%Auto-marked based on work days%';
