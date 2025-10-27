-- Fix employee category to use foreign key instead of text

-- 1. Add employee_category_id column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN employee_category_id uuid;

-- 2. Create a function to get or create employee category by name
CREATE OR REPLACE FUNCTION get_or_create_employee_category(category_name text)
RETURNS uuid AS $$
DECLARE
    category_id uuid;
BEGIN
    -- Try to find existing category
    SELECT id INTO category_id 
    FROM employee_categories 
    WHERE name = category_name;
    
    -- If not found, create it
    IF category_id IS NULL THEN
        INSERT INTO employee_categories (name, description, is_paid_leave_eligible, probation_period_months)
        VALUES (
            category_name,
            'Auto-created category for ' || category_name,
            CASE 
                WHEN category_name = 'permanent' THEN true
                WHEN category_name = 'intern' THEN false
                WHEN category_name = 'temporary' THEN false
                ELSE false
            END,
            CASE 
                WHEN category_name = 'permanent' THEN 3
                WHEN category_name = 'intern' THEN 0
                WHEN category_name = 'temporary' THEN 0
                ELSE 3
            END
        )
        RETURNING id INTO category_id;
    END IF;
    
    RETURN category_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Populate employee_category_id based on existing employee_category text values
UPDATE public.profiles 
SET employee_category_id = get_or_create_employee_category(employee_category)
WHERE employee_category_id IS NULL;

-- 4. Make employee_category_id NOT NULL
ALTER TABLE public.profiles 
ALTER COLUMN employee_category_id SET NOT NULL;

-- 5. Add foreign key constraint
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_employee_category_id_fkey 
FOREIGN KEY (employee_category_id) REFERENCES public.employee_categories(id);

-- 6. Update the refresh_employee_leave_balances function to use employee_category_id
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
            p.employee_category_id,
            p.joined_on_date,
            p.probation_period_months,
            ec.probation_period_months as category_probation_period,
            ec.is_paid_leave_eligible
        FROM profiles p
        LEFT JOIN employee_categories ec ON p.employee_category_id = ec.id
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
                    WHERE lp.employee_category_id = employee_record.employee_category_id
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
                        employee_category_id,
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
                        employee_record.employee_category_id,
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

-- 7. Drop all dependent triggers first
DROP TRIGGER IF EXISTS refresh_balances_on_employee_change ON profiles;
DROP TRIGGER IF EXISTS refresh_balances_on_policy_change ON leave_policies;
DROP TRIGGER IF EXISTS refresh_balances_on_category_change ON employee_categories;

-- 8. Update the trigger function to use employee_category_id
DROP FUNCTION IF EXISTS trigger_refresh_leave_balances();

CREATE OR REPLACE FUNCTION trigger_refresh_leave_balances()
RETURNS TRIGGER AS $$
DECLARE
    current_year INTEGER;
BEGIN
    -- Only refresh if the change affects leave calculations
    IF TG_OP = 'UPDATE' AND (
        OLD.employee_category_id IS DISTINCT FROM NEW.employee_category_id OR
        OLD.joined_on_date IS DISTINCT FROM NEW.joined_on_date OR
        OLD.probation_period_months IS DISTINCT FROM NEW.probation_period_months
    ) THEN
        -- Get current year as proper INTEGER
        current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
        
        -- Call the function with proper INTEGER type
        PERFORM refresh_employee_leave_balances(current_year);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 9. Recreate all triggers
CREATE TRIGGER refresh_balances_on_employee_change
    AFTER UPDATE OF employee_category_id, joined_on_date, probation_period_months ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_leave_balances();

CREATE TRIGGER refresh_balances_on_policy_change
    AFTER INSERT OR UPDATE OR DELETE ON leave_policies
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_leave_balances();

CREATE TRIGGER refresh_balances_on_category_change
    AFTER INSERT OR UPDATE OR DELETE ON employee_categories
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_leave_balances();

-- 10. Grant permissions
GRANT EXECUTE ON FUNCTION refresh_employee_leave_balances(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_refresh_leave_balances() TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_employee_category(text) TO authenticated;
