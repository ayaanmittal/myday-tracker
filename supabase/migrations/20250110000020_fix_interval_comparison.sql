-- Fix interval comparison error in refresh_employee_leave_balances function

-- Drop and recreate the function with proper date comparison
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
    probation_cutoff_date DATE;
BEGIN
    -- Set the target year
    IF target_year IS NULL THEN
        current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    ELSE
        current_year := target_year;
    END IF;

    -- Clear existing balances for the target year
    DELETE FROM leave_balances WHERE year = current_year;

    -- Loop through all active employees
    FOR employee_record IN
        SELECT 
            p.id,
            p.name,
            p.email,
            p.employee_category,
            p.joined_on_date,
            p.probation_period_months,
            ec.probation_period_months as category_probation_period,
            ec.is_paid_leave_eligible
        FROM profiles p
        LEFT JOIN employee_categories ec ON p.employee_category = ec.name
        WHERE p.is_active = true
    LOOP
        -- Check if employee is on probation with proper date comparison
        DECLARE
            is_on_probation BOOLEAN;
            probation_months INTEGER;
        BEGIN
            probation_months := COALESCE(employee_record.probation_period_months, employee_record.category_probation_period, 3);
            
            -- Calculate probation cutoff date properly
            probation_cutoff_date := CURRENT_DATE - (probation_months || ' months')::INTERVAL;
            is_on_probation := employee_record.joined_on_date > probation_cutoff_date;
            
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
                    WHERE lp.employee_category = employee_record.employee_category
                    AND lp.is_active = true
                    AND lt.is_active = true
                LOOP
                    -- Calculate allocated days based on probation status
                    IF is_on_probation THEN
                        allocated_days := 0;
                        probation_allocated_days := COALESCE(policy_record.probation_max_days, 0);
                    ELSE
                        allocated_days := policy_record.max_days_per_year;
                        probation_allocated_days := 0;
                    END IF;

                    -- Calculate used days from leave_requests
                    SELECT COALESCE(SUM(days_requested), 0) INTO used_days
                    FROM leave_requests
                    WHERE user_id = employee_record.id
                    AND leave_type_id = policy_record.leave_type_id
                    AND status = 'approved'
                    AND EXTRACT(YEAR FROM start_date) = current_year;

                    -- Calculate probation used days
                    IF is_on_probation THEN
                        probation_used_days := used_days;
                        used_days := 0;
                    ELSE
                        probation_used_days := 0;
                    END IF;

                    -- Insert the balance record
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
                        employee_record.id,
                        employee_record.id,
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
        'success', true,
        'year', current_year,
        'message', 'Leave balances refreshed successfully'
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION refresh_employee_leave_balances(INTEGER) TO authenticated;
