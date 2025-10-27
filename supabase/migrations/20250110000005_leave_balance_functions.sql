-- Create function to refresh employee leave balances
CREATE OR REPLACE FUNCTION refresh_employee_leave_balances(target_year INTEGER DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    current_year INTEGER;
    result JSON;
    employee_record RECORD;
    policy_record RECORD;
    balance_record RECORD;
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

-- Create function to get employee leave summary
CREATE OR REPLACE FUNCTION get_employee_leave_summary(emp_id UUID, target_year INTEGER DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    current_year INTEGER;
    result JSON;
    employee_info RECORD;
    balance_info RECORD;
    summary_data JSON;
BEGIN
    current_year := COALESCE(target_year, EXTRACT(YEAR FROM CURRENT_DATE));
    
    -- Get employee information
    SELECT 
        p.id,
        p.name,
        p.email,
        p.employee_category,
        p.joined_on_date,
        p.probation_period_months,
        ec.is_paid_leave_eligible
    INTO employee_info
    FROM profiles p
    LEFT JOIN employee_categories ec ON p.employee_category = ec.name
    WHERE p.id = emp_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Employee not found');
    END IF;
    
    -- Get leave balances
    SELECT 
        json_agg(
            json_build_object(
                'leave_type_id', lb.leave_type_id,
                'leave_type_name', lt.name,
                'allocated_days', lb.allocated_days,
                'used_days', lb.used_days,
                'remaining_days', lb.remaining_days,
                'probation_allocated_days', lb.probation_allocated_days,
                'probation_used_days', lb.probation_used_days,
                'probation_remaining_days', lb.probation_remaining_days,
                'is_paid', lb.is_paid,
                'requires_approval', lb.requires_approval
            )
        ) INTO summary_data
    FROM leave_balances lb
    JOIN leave_types lt ON lb.leave_type_id = lt.id
    WHERE lb.employee_id = emp_id AND lb.year = current_year;
    
    -- Build result
    SELECT json_build_object(
        'employee', json_build_object(
            'id', employee_info.id,
            'name', employee_info.name,
            'email', employee_info.email,
            'category', employee_info.employee_category,
            'joined_date', employee_info.joined_on_date,
            'probation_period_months', employee_info.probation_period_months,
            'is_paid_leave_eligible', employee_info.is_paid_leave_eligible
        ),
        'year', current_year,
        'leave_balances', COALESCE(summary_data, '[]'::json),
        'summary', json_build_object(
            'total_allocated', COALESCE((SELECT SUM(allocated_days) FROM leave_balances WHERE employee_id = emp_id AND year = current_year), 0),
            'total_used', COALESCE((SELECT SUM(used_days) FROM leave_balances WHERE employee_id = emp_id AND year = current_year), 0),
            'total_remaining', COALESCE((SELECT SUM(remaining_days) FROM leave_balances WHERE employee_id = emp_id AND year = current_year), 0),
            'probation_total_allocated', COALESCE((SELECT SUM(probation_allocated_days) FROM leave_balances WHERE employee_id = emp_id AND year = current_year), 0),
            'probation_total_used', COALESCE((SELECT SUM(probation_used_days) FROM leave_balances WHERE employee_id = emp_id AND year = current_year), 0),
            'probation_total_remaining', COALESCE((SELECT SUM(probation_remaining_days) FROM leave_balances WHERE employee_id = emp_id AND year = current_year), 0)
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create function to update leave usage
CREATE OR REPLACE FUNCTION update_leave_usage(
    emp_id UUID,
    leave_type_id UUID,
    days_used INTEGER,
    target_year INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    current_year INTEGER;
    result JSON;
    balance_record RECORD;
    is_on_probation BOOLEAN;
    probation_months INTEGER;
BEGIN
    current_year := COALESCE(target_year, EXTRACT(YEAR FROM CURRENT_DATE));
    
    -- Check if employee is on probation
    SELECT 
        p.joined_on_date,
        p.probation_period_months,
        ec.probation_period_months as category_probation_period
    INTO probation_months
    FROM profiles p
    LEFT JOIN employee_categories ec ON p.employee_category = ec.name
    WHERE p.id = emp_id;
    
    probation_months := COALESCE(probation_months, 3);
    is_on_probation := probation_months > (CURRENT_DATE - INTERVAL '1 month' * probation_months);
    
    -- Get current balance
    SELECT * INTO balance_record
    FROM leave_balances
    WHERE employee_id = emp_id 
    AND leave_type_id = leave_type_id 
    AND year = current_year;
    
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Leave balance not found for this employee and leave type');
    END IF;
    
    -- Update the balance
    IF is_on_probation THEN
        -- Update probation days
        UPDATE leave_balances
        SET 
            probation_used_days = probation_used_days + days_used,
            probation_remaining_days = probation_remaining_days - days_used
        WHERE employee_id = emp_id 
        AND leave_type_id = leave_type_id 
        AND year = current_year;
    ELSE
        -- Update regular days
        UPDATE leave_balances
        SET 
            used_days = used_days + days_used,
            remaining_days = remaining_days - days_used
        WHERE employee_id = emp_id 
        AND leave_type_id = leave_type_id 
        AND year = current_year;
    END IF;
    
    -- Return updated balance
    SELECT json_build_object(
        'success', true,
        'message', 'Leave usage updated successfully',
        'updated_balance', (
            SELECT json_build_object(
                'allocated_days', allocated_days,
                'used_days', used_days,
                'remaining_days', remaining_days,
                'probation_allocated_days', probation_allocated_days,
                'probation_used_days', probation_used_days,
                'probation_remaining_days', probation_remaining_days
            )
            FROM leave_balances
            WHERE employee_id = emp_id 
            AND leave_type_id = leave_type_id 
            AND year = current_year
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically refresh balances when policies change
CREATE OR REPLACE FUNCTION trigger_refresh_leave_balances()
RETURNS TRIGGER AS $$
BEGIN
    -- Refresh balances for current year when policies are updated
    PERFORM refresh_employee_leave_balances(EXTRACT(YEAR FROM CURRENT_DATE));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS refresh_balances_on_policy_change ON leave_policies;
CREATE TRIGGER refresh_balances_on_policy_change
    AFTER INSERT OR UPDATE OR DELETE ON leave_policies
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_leave_balances();

DROP TRIGGER IF EXISTS refresh_balances_on_category_change ON employee_categories;
CREATE TRIGGER refresh_balances_on_category_change
    AFTER INSERT OR UPDATE OR DELETE ON employee_categories
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_leave_balances();

DROP TRIGGER IF EXISTS refresh_balances_on_employee_change ON profiles;
CREATE TRIGGER refresh_balances_on_employee_change
    AFTER UPDATE OF employee_category, joined_on_date, probation_period_months ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_leave_balances();

-- Grant permissions
GRANT EXECUTE ON FUNCTION refresh_employee_leave_balances(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_leave_summary(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_leave_usage(UUID, UUID, INTEGER, INTEGER) TO authenticated;
