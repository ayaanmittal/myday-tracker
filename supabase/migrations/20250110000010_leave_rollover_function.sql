-- Add leave balance rollover functionality

-- Create function to roll over leave balances from previous year
CREATE OR REPLACE FUNCTION rollover_leave_balances(
    from_year INTEGER,
    to_year INTEGER,
    max_rollover_days INTEGER DEFAULT 5
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    employee_record RECORD;
    balance_record RECORD;
    rollover_days INTEGER;
    new_allocated_days INTEGER;
BEGIN
    -- Validate years
    IF from_year >= to_year THEN
        RETURN json_build_object(
            'success', false,
            'error', 'From year must be less than to year'
        );
    END IF;
    
    -- Loop through all employees with balances in the from_year
    FOR employee_record IN 
        SELECT DISTINCT employee_id
        FROM leave_balances 
        WHERE year = from_year
    LOOP
        -- Get all leave balances for this employee in the from_year
        FOR balance_record IN
            SELECT 
                lb.*,
                lt.name as leave_type_name
            FROM leave_balances lb
            JOIN leave_types lt ON lb.leave_type_id = lt.id
            WHERE lb.employee_id = employee_record.employee_id 
            AND lb.year = from_year
        LOOP
            -- Calculate rollover days (limited by max_rollover_days)
            rollover_days := LEAST(
                balance_record.remaining_days + balance_record.probation_remaining_days,
                max_rollover_days
            );
            
            -- Get the new allocation for the to_year
            SELECT 
                CASE 
                    WHEN p.joined_on_date > (CURRENT_DATE - INTERVAL '1 month' * COALESCE(p.probation_period_months, 3))
                    THEN lp.probation_max_days
                    ELSE lp.max_days_per_year
                END INTO new_allocated_days
            FROM leave_policies lp
            JOIN profiles p ON p.employee_category = (
                SELECT name FROM employee_categories WHERE id = lp.employee_category_id
            )
            WHERE lp.leave_type_id = balance_record.leave_type_id
            AND lp.is_active = true
            AND p.id = employee_record.employee_id;
            
            -- If no policy found, skip this balance
            IF new_allocated_days IS NULL THEN
                CONTINUE;
            END IF;
            
            -- Create new balance for to_year with rollover
            INSERT INTO leave_balances (
                employee_id,
                leave_type_id,
                year,
                allocated_days,
                used_days,
                remaining_days,
                probation_allocated_days,
                probation_used_days,
                probation_remaining_days,
                is_paid,
                requires_approval
            ) VALUES (
                balance_record.employee_id,
                balance_record.leave_type_id,
                to_year,
                new_allocated_days,
                0,
                new_allocated_days + rollover_days,
                0,
                0,
                0,
                balance_record.is_paid,
                balance_record.requires_approval
            )
            ON CONFLICT (employee_id, leave_type_id, year) 
            DO UPDATE SET
                remaining_days = leave_balances.remaining_days + rollover_days,
                allocated_days = new_allocated_days + rollover_days;
        END LOOP;
    END LOOP;
    
    -- Return summary
    SELECT json_build_object(
        'success', true,
        'from_year', from_year,
        'to_year', to_year,
        'max_rollover_days', max_rollover_days,
        'employees_processed', (SELECT COUNT(DISTINCT employee_id) FROM leave_balances WHERE year = from_year),
        'balances_created', (SELECT COUNT(*) FROM leave_balances WHERE year = to_year),
        'message', 'Leave balances rolled over successfully'
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create function to get rollover summary
CREATE OR REPLACE FUNCTION get_rollover_summary(
    from_year INTEGER,
    to_year INTEGER
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'from_year', from_year,
        'to_year', to_year,
        'employees_with_balances', (
            SELECT COUNT(DISTINCT employee_id) 
            FROM leave_balances 
            WHERE year = from_year
        ),
        'total_remaining_days', (
            SELECT COALESCE(SUM(remaining_days + probation_remaining_days), 0)
            FROM leave_balances 
            WHERE year = from_year
        ),
        'eligible_for_rollover', (
            SELECT COUNT(DISTINCT employee_id)
            FROM leave_balances 
            WHERE year = from_year 
            AND (remaining_days > 0 OR probation_remaining_days > 0)
        ),
        'balances_in_target_year', (
            SELECT COUNT(*)
            FROM leave_balances 
            WHERE year = to_year
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION rollover_leave_balances(INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rollover_summary(INTEGER, INTEGER) TO authenticated;


