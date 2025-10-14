-- Auto-mark attendance status based on work days configuration
-- This migration creates a system to automatically mark attendance as absent/holiday based on employee work days

-- Create function to auto-mark attendance based on work days
CREATE OR REPLACE FUNCTION auto_mark_attendance_based_on_work_days()
RETURNS TRIGGER AS $$
DECLARE
    work_days_config RECORD;
    day_of_week INTEGER;
    is_work_day BOOLEAN;
    has_attendance BOOLEAN;
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

-- Create trigger to auto-mark attendance based on work days
DROP TRIGGER IF EXISTS trigger_auto_mark_attendance_work_days ON public.unified_attendance;
CREATE TRIGGER trigger_auto_mark_attendance_work_days
  BEFORE INSERT OR UPDATE ON public.unified_attendance
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_attendance_based_on_work_days();

-- Create function to process existing records based on work days
CREATE OR REPLACE FUNCTION process_existing_attendance_based_on_work_days(
    start_date_param DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date_param DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    user_id UUID,
    entry_date DATE,
    old_status TEXT,
    new_status TEXT,
    processed_count INTEGER
) AS $$
DECLARE
    attendance_record RECORD;
    work_days_config RECORD;
    day_of_week INTEGER;
    is_work_day BOOLEAN;
    processed_count INTEGER := 0;
    new_status TEXT;
BEGIN
    -- Loop through all attendance records in the date range
    FOR attendance_record IN 
        SELECT ua.user_id, ua.entry_date, ua.status, ua.check_in_at, ua.check_out_at, ua.modification_reason
        FROM public.unified_attendance ua
        WHERE ua.entry_date BETWEEN start_date_param AND end_date_param
        AND ua.status NOT IN ('holiday', 'absent') -- Don't process already marked records
    LOOP
        -- Get work days configuration for this user
        SELECT * INTO work_days_config FROM get_employee_work_days(attendance_record.user_id);
        
        -- Get day of week
        day_of_week := EXTRACT(DOW FROM attendance_record.entry_date);
        
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
        
        -- Determine new status
        IF is_work_day AND (attendance_record.check_in_at IS NULL AND attendance_record.check_out_at IS NULL) THEN
            new_status := 'absent';
        ELSIF NOT is_work_day THEN
            new_status := 'holiday';
        ELSE
            new_status := attendance_record.status; -- Keep existing status
        END IF;
        
        -- Update the record if status needs to change
        IF new_status != attendance_record.status THEN
            UPDATE public.unified_attendance 
            SET 
                status = new_status,
                modification_reason = COALESCE(modification_reason, '') || '; Auto-marked based on work days',
                updated_at = NOW()
            WHERE user_id = attendance_record.user_id 
            AND entry_date = attendance_record.entry_date;
            
            -- Return the processed record
            user_id := attendance_record.user_id;
            entry_date := attendance_record.entry_date;
            old_status := attendance_record.status;
            new_status := new_status;
            processed_count := 1;
            RETURN NEXT;
            
            processed_count := processed_count + 1;
        END IF;
    END LOOP;
    
    -- Return summary
    user_id := NULL;
    entry_date := NULL;
    old_status := 'summary';
    new_status := 'processed';
    processed_count := processed_count;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate missing attendance records for work days
CREATE OR REPLACE FUNCTION generate_missing_work_day_records(
    start_date_param DATE,
    end_date_param DATE
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
    work_days_config RECORD;
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
        SELECT * INTO work_days_config FROM get_employee_work_days(user_record.id);
        
        -- Loop through each date in the range
        check_date := start_date_param;
        WHILE check_date <= end_date_param LOOP
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
                    'Generated based on work days configuration'
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
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_existing_attendance_based_on_work_days(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_missing_work_day_records(DATE, DATE) TO authenticated;

-- Process existing records for the last 30 days
SELECT * FROM process_existing_attendance_based_on_work_days(
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE
);

-- Show summary
DO $$
DECLARE
    processed_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO processed_count
    FROM public.unified_attendance
    WHERE modification_reason LIKE '%Auto-marked based on work days%';
    
    RAISE NOTICE 'Work days auto-marking system activated!';
    RAISE NOTICE 'Processed % existing records based on work days configuration', processed_count;
    RAISE NOTICE 'Future records will be automatically marked based on work days';
END $$;
