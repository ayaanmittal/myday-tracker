-- Fix Attendance Summary Calculation
-- This migration fixes the get_attendance_summary_with_holidays function to properly handle office holidays

-- Step 1: Update the get_attendance_summary_with_holidays function
CREATE OR REPLACE FUNCTION get_attendance_summary_with_holidays(
    employee_user_id UUID,
    start_date DATE,
    end_date DATE
)
RETURNS TABLE(
    total_days INTEGER,
    work_days INTEGER,
    present_days INTEGER,
    absent_days INTEGER,
    holiday_days INTEGER,
    in_progress_days INTEGER
) AS $$
DECLARE
    work_days_config RECORD;
    check_date DATE;
    day_of_week INTEGER;
    is_work_day BOOLEAN;
    has_attendance BOOLEAN;
    attendance_status TEXT;
    attendance_manual_status TEXT;
BEGIN
    -- Get work days configuration for the employee
    SELECT * INTO work_days_config FROM get_employee_work_days(employee_user_id);
    
    -- Initialize counters
    total_days := 0;
    work_days := 0;
    present_days := 0;
    absent_days := 0;
    holiday_days := 0;
    in_progress_days := 0;
    
    -- Loop through each date in the range
    check_date := start_date;
    WHILE check_date <= end_date LOOP
        total_days := total_days + 1;
        
        -- Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
        day_of_week := EXTRACT(DOW FROM check_date);
        
        -- Determine if this is a work day
        is_work_day := CASE day_of_week
            WHEN 0 THEN work_days_config.sunday
            WHEN 1 THEN work_days_config.monday
            WHEN 2 THEN work_days_config.tuesday
            WHEN 3 THEN work_days_config.wednesday
            WHEN 4 THEN work_days_config.thursday
            WHEN 5 THEN work_days_config.friday
            WHEN 6 THEN work_days_config.saturday
        END;
        
        IF is_work_day THEN
            work_days := work_days + 1;
            
            -- Check if there's any attendance record for this date
            SELECT EXISTS(
                SELECT 1 FROM public.unified_attendance 
                WHERE user_id = employee_user_id 
                AND entry_date = check_date
            ) INTO has_attendance;
            
            IF has_attendance THEN
                -- Get the status and manual_status of the attendance record
                SELECT status, manual_status INTO attendance_status, attendance_manual_status
                FROM public.unified_attendance 
                WHERE user_id = employee_user_id 
                AND entry_date = check_date
                LIMIT 1;
                
                -- Check for office holidays first (manual_status = 'Office Holiday')
                IF attendance_manual_status = 'Office Holiday' THEN
                    holiday_days := holiday_days + 1;
                ELSE
                    -- Use the status field for other cases
                    CASE attendance_status
                        WHEN 'completed' THEN present_days := present_days + 1;
                        WHEN 'in_progress' THEN in_progress_days := in_progress_days + 1;
                        WHEN 'absent' THEN absent_days := absent_days + 1;
                        WHEN 'holiday' THEN holiday_days := holiday_days + 1;
                    END CASE;
                END IF;
            ELSE
                -- No attendance record on a work day = absent
                absent_days := absent_days + 1;
            END IF;
        ELSE
            -- Non-work day = holiday
            holiday_days := holiday_days + 1;
        END IF;
        
        check_date := check_date + INTERVAL '1 day';
    END LOOP;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Grant execute permissions
GRANT EXECUTE ON FUNCTION get_attendance_summary_with_holidays(UUID, DATE, DATE) TO authenticated;

-- Step 3: Test the updated function
SELECT 'Step 3: Test updated attendance summary function' as step;
SELECT * FROM get_attendance_summary_with_holidays(
    (SELECT id FROM public.profiles WHERE name ILIKE '%dolly%' LIMIT 1),
    '2025-02-01'::DATE,
    '2025-02-28'::DATE
);

-- Step 4: Create a new function specifically for work history stat cards
CREATE OR REPLACE FUNCTION get_work_history_stats(
    employee_user_id UUID,
    start_date DATE,
    end_date DATE
)
RETURNS TABLE(
    total_days INTEGER,
    work_days INTEGER,
    present_days INTEGER,
    absent_days INTEGER,
    holiday_days INTEGER,
    in_progress_days INTEGER
) AS $$
DECLARE
    work_days_config RECORD;
    check_date DATE;
    day_of_week INTEGER;
    is_work_day BOOLEAN;
    has_attendance BOOLEAN;
    attendance_status TEXT;
    attendance_manual_status TEXT;
BEGIN
    -- Get work days configuration for the employee
    SELECT * INTO work_days_config FROM get_employee_work_days(employee_user_id);
    
    -- Initialize counters
    total_days := 0;
    work_days := 0;
    present_days := 0;
    absent_days := 0;
    holiday_days := 0;
    in_progress_days := 0;
    
    -- Loop through each date in the range
    check_date := start_date;
    WHILE check_date <= end_date LOOP
        total_days := total_days + 1;
        
        -- Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
        day_of_week := EXTRACT(DOW FROM check_date);
        
        -- Determine if this is a work day
        is_work_day := CASE day_of_week
            WHEN 0 THEN work_days_config.sunday
            WHEN 1 THEN work_days_config.monday
            WHEN 2 THEN work_days_config.tuesday
            WHEN 3 THEN work_days_config.wednesday
            WHEN 4 THEN work_days_config.thursday
            WHEN 5 THEN work_days_config.friday
            WHEN 6 THEN work_days_config.saturday
        END;
        
        IF is_work_day THEN
            work_days := work_days + 1;
            
            -- Check if there's any attendance record for this date
            SELECT EXISTS(
                SELECT 1 FROM public.unified_attendance 
                WHERE user_id = employee_user_id 
                AND entry_date = check_date
            ) INTO has_attendance;
            
            IF has_attendance THEN
                -- Get the status and manual_status of the attendance record
                SELECT status, manual_status INTO attendance_status, attendance_manual_status
                FROM public.unified_attendance 
                WHERE user_id = employee_user_id 
                AND entry_date = check_date
                LIMIT 1;
                
                -- Check for office holidays first (manual_status = 'Office Holiday')
                IF attendance_manual_status = 'Office Holiday' THEN
                    holiday_days := holiday_days + 1;
                ELSE
                    -- Use the status field for other cases
                    CASE attendance_status
                        WHEN 'completed' THEN present_days := present_days + 1;
                        WHEN 'in_progress' THEN in_progress_days := in_progress_days + 1;
                        WHEN 'absent' THEN absent_days := absent_days + 1;
                        WHEN 'holiday' THEN holiday_days := holiday_days + 1;
                    END CASE;
                END IF;
            ELSE
                -- No attendance record on a work day = absent
                absent_days := absent_days + 1;
            END IF;
        ELSE
            -- Non-work day = holiday
            holiday_days := holiday_days + 1;
        END IF;
        
        check_date := check_date + INTERVAL '1 day';
    END LOOP;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Grant execute permissions
GRANT EXECUTE ON FUNCTION get_work_history_stats(UUID, DATE, DATE) TO authenticated;

-- Step 6: Test the new function
SELECT 'Step 6: Test new work history stats function' as step;
SELECT * FROM get_work_history_stats(
    (SELECT id FROM public.profiles WHERE name ILIKE '%dolly%' LIMIT 1),
    '2025-02-01'::DATE,
    '2025-02-28'::DATE
);
