-- Fix function type mismatches and ensure proper function signatures

-- Drop and recreate the refresh_employee_leave_balances function with proper types
DROP FUNCTION IF EXISTS refresh_employee_leave_balances(INTEGER);
DROP FUNCTION IF EXISTS refresh_employee_leave_balances(numeric);

-- Create the function with proper INTEGER type
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
    remaining_days INTEGER;
    probation_remaining_days INTEGER;
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
                    
                    -- Calculate used days (this would need to be implemented based on actual leave records)
                    used_days := 0;
                    probation_used_days := 0;
                    
                    -- Calculate remaining days
                    remaining_days := allocated_days - used_days;
                    probation_remaining_days := probation_allocated_days - probation_used_days;
                    
                    -- Insert or update the balance record
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
                        employee_record.employee_id,
                        policy_record.leave_type_id,
                        current_year,
                        allocated_days,
                        used_days,
                        remaining_days,
                        probation_allocated_days,
                        probation_used_days,
                        probation_remaining_days,
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
        'message', 'Leave balances refreshed successfully'
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Also fix the rollover functions with proper types
DROP FUNCTION IF EXISTS rollover_leave_balances(INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS rollover_leave_balances(numeric, numeric, numeric);

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

-- Fix get_rollover_summary function
DROP FUNCTION IF EXISTS get_rollover_summary(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_rollover_summary(numeric, numeric);

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
GRANT EXECUTE ON FUNCTION refresh_employee_leave_balances(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION rollover_leave_balances(INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rollover_summary(INTEGER, INTEGER) TO authenticated;
