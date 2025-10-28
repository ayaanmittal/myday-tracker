-- Fix user_id column mapping in leave_balances table

-- First, let's check the current table structure and fix any issues
DO $$ 
BEGIN
    -- Check if user_id column exists and is properly set up
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'leave_balances' 
        AND column_name = 'user_id'
    ) THEN
        -- Add user_id column if it doesn't exist
        ALTER TABLE leave_balances 
        ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
    
    -- Make sure user_id is not null if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'leave_balances' 
        AND column_name = 'user_id'
        AND is_nullable = 'YES'
    ) THEN
        -- Update existing records to set user_id from employee_id
        UPDATE leave_balances 
        SET user_id = employee_id 
        WHERE user_id IS NULL AND employee_id IS NOT NULL;
        
        -- Make user_id not null
        ALTER TABLE leave_balances 
        ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;

-- Update the refresh function to use user_id instead of employee_id
DROP FUNCTION IF EXISTS refresh_employee_leave_balances(INTEGER);

CREATE OR REPLACE FUNCTION refresh_employee_leave_balances(target_year INTEGER DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    current_year INTEGER;
    result JSON;
    employee_record RECORD;
    policy_record RECORD;
    allocated_days INTEGER;
    probation_allocated_days INTEGER;
    used_days INTEGER;
    probation_used_days INTEGER;
BEGIN
    -- Use current year if not specified
    current_year := COALESCE(target_year, EXTRACT(YEAR FROM CURRENT_DATE));
    
    -- Clear existing balances for the target year
    DELETE FROM leave_balances WHERE year = current_year;
    
    -- Loop through all active employees
    FOR employee_record IN 
        SELECT 
            p.id as employee_id,
            p.name,
            p.email,
            p.employee_category,
            p.joined_on_date,
            p.probation_period_months,
            ec.is_paid_leave_eligible,
            ec.probation_period_months as category_probation_period
        FROM profiles p
        LEFT JOIN employee_categories ec ON p.employee_category = ec.name
        WHERE p.is_active = true
    LOOP
        -- Check if employee is on probation
        DECLARE
            is_on_probation BOOLEAN;
            probation_months INTEGER;
        BEGIN
            probation_months := COALESCE(employee_record.probation_period_months, employee_record.category_probation_period, 3);
            is_on_probation := employee_record.joined_on_date > (CURRENT_DATE - INTERVAL '1 month' * probation_months);
            
            -- Only create balances for employees eligible for paid leaves
            IF employee_record.is_paid_leave_eligible THEN
                -- Loop through all active leave policies for this employee's category
                FOR policy_record IN
                    SELECT 
                        lp.*,
                        lt.name as leave_type_name,
                        lt.is_paid,
                        lt.requires_approval
                    FROM leave_policies lp
                    JOIN leave_types lt ON lp.leave_type_id = lt.id
                    WHERE lp.employee_category_id = (
                        SELECT id FROM employee_categories WHERE name = employee_record.employee_category
                    )
                    AND lp.is_active = true
                    AND lt.is_active = true
                LOOP
                    -- Calculate allocated days based on probation status
                    IF is_on_probation THEN
                        allocated_days := 0;
                        probation_allocated_days := policy_record.probation_max_days;
                    ELSE
                        allocated_days := policy_record.max_days_per_year;
                        probation_allocated_days := 0;
                    END IF;
                    
                    -- Calculate actual used days from leave_requests table
                    SELECT COALESCE(SUM(days_requested), 0) INTO used_days
                    FROM leave_requests lr
                    WHERE lr.user_id = employee_record.employee_id
                    AND lr.leave_type_id = policy_record.leave_type_id
                    AND lr.status = 'approved'
                    AND EXTRACT(YEAR FROM lr.start_date) = current_year;
                    
                    -- For probation employees, all approved leaves count as probation used days
                    IF is_on_probation THEN
                        probation_used_days := used_days;
                        used_days := 0;
                    ELSE
                        probation_used_days := 0;
                    END IF;
                    
                    -- Insert the balance record using user_id
                    INSERT INTO leave_balances (
                        user_id,
                        employee_id,
                        leave_type_id,
                        year,
                        allocated_days,
                        used_days,
                        probation_allocated_days,
                        probation_used_days,
                        is_paid,
                        requires_approval
                    ) VALUES (
                        employee_record.employee_id,  -- user_id = employee_id (profiles.id)
                        employee_record.employee_id,  -- employee_id for reference
                        policy_record.leave_type_id,
                        current_year,
                        allocated_days,
                        used_days,
                        probation_allocated_days,
                        probation_used_days,
                        policy_record.is_paid,
                        policy_record.requires_approval
                    );
                END LOOP;
            END IF;
        END;
    END LOOP;
    
    -- Return summary
    SELECT json_build_object(
        'year', current_year,
        'employees_processed', (SELECT COUNT(*) FROM profiles WHERE is_active = true),
        'balances_created', (SELECT COUNT(*) FROM leave_balances WHERE year = current_year),
        'message', 'Leave balances refreshed successfully with correct user_id mapping'
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION refresh_employee_leave_balances(INTEGER) TO authenticated;

