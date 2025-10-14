-- Add holiday status to attendance system
-- This migration adds 'holiday' as a valid status and creates functions to generate attendance records

-- First, update the status constraint to include 'holiday'
ALTER TABLE public.unified_attendance 
DROP CONSTRAINT IF EXISTS unified_attendance_status_check;

ALTER TABLE public.unified_attendance 
ADD CONSTRAINT unified_attendance_status_check 
CHECK (status IN ('in_progress', 'completed', 'absent', 'holiday'));

-- Update the trigger function to handle holiday status
CREATE OR REPLACE FUNCTION update_attendance_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If check_out_at is set and status is in_progress, change to completed
  IF NEW.check_out_at IS NOT NULL AND NEW.status = 'in_progress' THEN
    NEW.status := 'completed';
  END IF;
  
  -- If check_out_at is NULL and status is completed, change to in_progress
  IF NEW.check_out_at IS NULL AND NEW.status = 'completed' THEN
    NEW.status := 'in_progress';
  END IF;
  
  -- If both check_in_at and check_out_at are NULL, status should be absent
  IF NEW.check_in_at IS NULL AND NEW.check_out_at IS NULL THEN
    NEW.status := 'absent';
  END IF;
  
  -- If check_in_at exists but check_out_at is NULL, status should be in_progress
  IF NEW.check_in_at IS NOT NULL AND NEW.check_out_at IS NULL THEN
    NEW.status := 'in_progress';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate attendance records for missing days
CREATE OR REPLACE FUNCTION generate_missing_attendance_records(
    start_date DATE,
    end_date DATE
)
RETURNS TABLE(
    user_id UUID,
    entry_date DATE,
    status TEXT,
    generated_count INTEGER
) AS $$
DECLARE
    check_date DATE;
    day_of_week INTEGER;
    is_work_day BOOLEAN;
    work_days RECORD;
    user_record RECORD;
    existing_record_count INTEGER;
    generated_count INTEGER := 0;
BEGIN
    -- Loop through all active users
    FOR user_record IN 
        SELECT id, name 
        FROM public.profiles 
        WHERE is_active = true
    LOOP
        -- Get work days configuration for this user
        SELECT * INTO work_days FROM get_employee_work_days(user_record.id);
        
        -- Loop through each date in the range
        check_date := start_date;
        WHILE check_date <= end_date LOOP
            -- Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
            day_of_week := EXTRACT(DOW FROM check_date);
            
            -- Determine if this is a work day
            is_work_day := CASE day_of_week
                WHEN 0 THEN work_days.sunday
                WHEN 1 THEN work_days.monday
                WHEN 2 THEN work_days.tuesday
                WHEN 3 THEN work_days.wednesday
                WHEN 4 THEN work_days.thursday
                WHEN 5 THEN work_days.friday
                WHEN 6 THEN work_days.saturday
            END;
            
            -- Check if attendance record already exists for this date
            SELECT COUNT(*) INTO existing_record_count
            FROM public.unified_attendance 
            WHERE user_id = user_record.id 
            AND entry_date = check_date;
            
            -- Only create record if none exists
            IF existing_record_count = 0 THEN
                -- Insert attendance record based on work day status
                INSERT INTO public.unified_attendance (
                    user_id,
                    entry_date,
                    check_in_at,
                    check_out_at,
                    total_work_time_minutes,
                    status,
                    is_late,
                    device_info,
                    source,
                    modification_reason
                ) VALUES (
                    user_record.id,
                    check_date,
                    NULL,
                    NULL,
                    0,
                    CASE 
                        WHEN is_work_day THEN 'absent'  -- Work day but no check-in = absent
                        ELSE 'holiday'                  -- Non-work day = holiday
                    END,
                    false,
                    'System Generated',
                    'system',
                    'Generated for missing attendance record'
                );
                
                generated_count := generated_count + 1;
                
                -- Return the generated record
                user_id := user_record.id;
                entry_date := check_date;
                status := CASE 
                    WHEN is_work_day THEN 'absent'
                    ELSE 'holiday'
                END;
                generated_count := 1;
                RETURN NEXT;
            END IF;
            
            check_date := check_date + INTERVAL '1 day';
        END LOOP;
    END LOOP;
    
    -- Return summary
    user_id := NULL;
    entry_date := NULL;
    status := 'summary';
    generated_count := generated_count;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update existing absent records to holiday if not work days
CREATE OR REPLACE FUNCTION update_absent_to_holiday(
    start_date DATE,
    end_date DATE
)
RETURNS TABLE(
    user_id UUID,
    entry_date DATE,
    old_status TEXT,
    new_status TEXT,
    updated_count INTEGER
) AS $$
DECLARE
    check_date DATE;
    day_of_week INTEGER;
    is_work_day BOOLEAN;
    work_days RECORD;
    user_record RECORD;
    updated_count INTEGER := 0;
BEGIN
    -- Loop through all users with absent records in the date range
    FOR user_record IN 
        SELECT DISTINCT ua.user_id, p.name
        FROM public.unified_attendance ua
        JOIN public.profiles p ON p.id = ua.user_id
        WHERE ua.entry_date BETWEEN start_date AND end_date
        AND ua.status = 'absent'
        AND p.is_active = true
    LOOP
        -- Get work days configuration for this user
        SELECT * INTO work_days FROM get_employee_work_days(user_record.user_id);
        
        -- Update absent records that are not work days
        UPDATE public.unified_attendance 
        SET 
            status = 'holiday',
            modification_reason = COALESCE(modification_reason, '') || '; Updated to holiday (not work day)'
        WHERE user_id = user_record.user_id
        AND entry_date BETWEEN start_date AND end_date
        AND status = 'absent'
        AND (
            CASE EXTRACT(DOW FROM entry_date)
                WHEN 0 THEN NOT work_days.sunday
                WHEN 1 THEN NOT work_days.monday
                WHEN 2 THEN NOT work_days.tuesday
                WHEN 3 THEN NOT work_days.wednesday
                WHEN 4 THEN NOT work_days.thursday
                WHEN 5 THEN NOT work_days.friday
                WHEN 6 THEN NOT work_days.saturday
            END
        );
        
        -- Get count of updated records
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        
        -- Return updated records
        FOR check_date IN 
            SELECT entry_date 
            FROM public.unified_attendance 
            WHERE user_id = user_record.user_id
            AND entry_date BETWEEN start_date AND end_date
            AND status = 'holiday'
            AND modification_reason LIKE '%Updated to holiday%'
        LOOP
            user_id := user_record.user_id;
            entry_date := check_date;
            old_status := 'absent';
            new_status := 'holiday';
            updated_count := 1;
            RETURN NEXT;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_missing_attendance_records(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION update_absent_to_holiday(DATE, DATE) TO authenticated;

-- Create a function to get attendance summary with holiday distinction
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
                -- Get the status of the attendance record
                SELECT status INTO attendance_status
                FROM public.unified_attendance 
                WHERE user_id = employee_user_id 
                AND entry_date = check_date
                LIMIT 1;
                
                CASE attendance_status
                    WHEN 'completed' THEN present_days := present_days + 1;
                    WHEN 'in_progress' THEN in_progress_days := in_progress_days + 1;
                    WHEN 'absent' THEN absent_days := absent_days + 1;
                    WHEN 'holiday' THEN holiday_days := holiday_days + 1;
                END CASE;
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_attendance_summary_with_holidays(UUID, DATE, DATE) TO authenticated;
