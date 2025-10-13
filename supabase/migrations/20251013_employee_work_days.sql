-- Create employee_work_days table to store work day configurations
CREATE TABLE IF NOT EXISTS public.employee_work_days (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    monday BOOLEAN DEFAULT true,
    tuesday BOOLEAN DEFAULT true,
    wednesday BOOLEAN DEFAULT true,
    thursday BOOLEAN DEFAULT true,
    friday BOOLEAN DEFAULT true,
    saturday BOOLEAN DEFAULT false,
    sunday BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.employee_work_days ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow users to view their own work days" ON public.employee_work_days
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow admins to view all work days" ON public.employee_work_days
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Allow users to update their own work days" ON public.employee_work_days
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Allow admins to manage all work days" ON public.employee_work_days
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

-- Create function to get work days for a user
CREATE OR REPLACE FUNCTION get_employee_work_days(employee_user_id UUID)
RETURNS TABLE(
    monday BOOLEAN,
    tuesday BOOLEAN,
    wednesday BOOLEAN,
    thursday BOOLEAN,
    friday BOOLEAN,
    saturday BOOLEAN,
    sunday BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(ewd.monday, true) as monday,
        COALESCE(ewd.tuesday, true) as tuesday,
        COALESCE(ewd.wednesday, true) as wednesday,
        COALESCE(ewd.thursday, true) as thursday,
        COALESCE(ewd.friday, true) as friday,
        COALESCE(ewd.saturday, false) as saturday,
        COALESCE(ewd.sunday, false) as sunday
    FROM public.employee_work_days ewd
    WHERE ewd.user_id = employee_user_id
    
    UNION ALL
    
    -- Default work days if no record exists
    SELECT 
        true as monday,
        true as tuesday,
        true as wednesday,
        true as thursday,
        true as friday,
        false as saturday,
        false as sunday
    WHERE NOT EXISTS (
        SELECT 1 FROM public.employee_work_days 
        WHERE user_id = employee_user_id
    )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to calculate days absent
CREATE OR REPLACE FUNCTION calculate_days_absent(
    employee_user_id UUID,
    start_date DATE,
    end_date DATE
)
RETURNS INTEGER AS $$
DECLARE
    work_days RECORD;
    check_date DATE;
    days_absent INTEGER := 0;
    day_of_week INTEGER;
    is_work_day BOOLEAN;
    has_attendance BOOLEAN;
BEGIN
    -- Get work days configuration for the employee
    SELECT * INTO work_days FROM get_employee_work_days(employee_user_id);
    
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
        
        -- Only count as absent if it's a work day
        IF is_work_day THEN
            -- Check if there's any attendance record for this date
            SELECT EXISTS(
                SELECT 1 FROM public.unified_attendance 
                WHERE user_id = employee_user_id 
                AND DATE(created_at) = check_date
            ) INTO has_attendance;
            
            -- If no attendance on a work day, count as absent
            IF NOT has_attendance THEN
                days_absent := days_absent + 1;
            END IF;
        END IF;
        
        check_date := check_date + INTERVAL '1 day';
    END LOOP;
    
    RETURN days_absent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_employee_work_days(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_days_absent(UUID, DATE, DATE) TO authenticated;
