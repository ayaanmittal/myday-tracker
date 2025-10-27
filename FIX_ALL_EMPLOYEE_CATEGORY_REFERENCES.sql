-- Fix All Employee Category References
-- This script updates all database functions to use employee_category_id instead of employee_category

-- Step 1: Update refresh_employee_leave_balances function
CREATE OR REPLACE FUNCTION refresh_employee_leave_balances(p_year INTEGER)
RETURNS VOID AS $$
DECLARE
    employee_record RECORD;
    leave_type_record RECORD;
    policy_record RECORD;
    total_days INTEGER;
    probation_days INTEGER;
    is_paid BOOLEAN;
    requires_approval BOOLEAN;
BEGIN
    -- Clear existing balances for the year
    DELETE FROM leave_balances WHERE year = p_year;
    
    -- Get all active employees with their categories
    FOR employee_record IN
        SELECT 
            p.id as user_id,
            p.employee_category_id,
            p.joined_on_date,
            p.probation_period_months,
            ec.name as category_name,
            ec.is_paid_leave_eligible
        FROM profiles p
        LEFT JOIN employee_categories ec ON p.employee_category_id = ec.id
        WHERE p.is_active = true
    LOOP
        -- Get all leave types
        FOR leave_type_record IN
            SELECT id, name, max_days_per_year, is_paid, requires_approval
            FROM leave_types
            WHERE is_active = true
        LOOP
            -- Find matching policy
            SELECT 
                max_days_per_year,
                probation_max_days,
                is_paid,
                requires_approval
            INTO 
                total_days,
                probation_days,
                is_paid,
                requires_approval
            FROM leave_policies
            WHERE employee_category_id = employee_record.employee_category_id
              AND leave_type_id = leave_type_record.id
              AND is_active = true;
            
            -- If no policy found, use leave type defaults
            IF total_days IS NULL THEN
                total_days := leave_type_record.max_days_per_year;
                probation_days := 0;
                is_paid := leave_type_record.is_paid;
                requires_approval := leave_type_record.requires_approval;
            END IF;
            
            -- Insert balance record
            INSERT INTO leave_balances (
                user_id,
                leave_type_id,
                year,
                total_days,
                used_days,
                employee_category_id,
                probation_eligible,
                employee_id,
                allocated_days,
                probation_allocated_days,
                is_paid,
                requires_approval,
                remaining_days,
                probation_remaining_days
            ) VALUES (
                employee_record.user_id,
                leave_type_record.id,
                p_year,
                total_days,
                0,
                employee_record.employee_category_id,
                (employee_record.joined_on_date + INTERVAL '1 year' * employee_record.probation_period_months) > CURRENT_DATE,
                employee_record.user_id,
                total_days,
                probation_days,
                is_paid,
                requires_approval,
                total_days,
                probation_days
            );
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Update auto_calculate_used_days function
CREATE OR REPLACE FUNCTION auto_calculate_used_days()
RETURNS TRIGGER AS $$
DECLARE
    employee_record RECORD;
    leave_type_record RECORD;
    used_days INTEGER;
    probation_used_days INTEGER;
BEGIN
    -- Get employee details
    SELECT 
        p.employee_category_id,
        p.joined_on_date,
        p.probation_period_months,
        ec.name as category_name
    INTO employee_record
    FROM profiles p
    LEFT JOIN employee_categories ec ON p.employee_category_id = ec.id
    WHERE p.id = NEW.user_id;
    
    -- Calculate used days for each leave type
    FOR leave_type_record IN
        SELECT id, name
        FROM leave_types
        WHERE is_active = true
    LOOP
        -- Calculate total used days
        SELECT COALESCE(SUM(days_requested), 0)
        INTO used_days
        FROM leave_requests
        WHERE user_id = NEW.user_id
          AND leave_type_id = leave_type_record.id
          AND status = 'approved'
          AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM NEW.leave_date);
        
        -- Calculate probation used days
        SELECT COALESCE(SUM(days_requested), 0)
        INTO probation_used_days
        FROM leave_requests
        WHERE user_id = NEW.user_id
          AND leave_type_id = leave_type_record.id
          AND status = 'approved'
          AND start_date >= employee_record.joined_on_date
          AND start_date <= (employee_record.joined_on_date + INTERVAL '1 year' * employee_record.probation_period_months);
        
        -- Update the balance
        UPDATE leave_balances
        SET 
            used_days = used_days,
            probation_used_days = probation_used_days,
            remaining_days = allocated_days - used_days,
            probation_remaining_days = probation_allocated_days - probation_used_days
        WHERE user_id = NEW.user_id
          AND leave_type_id = leave_type_record.id
          AND year = EXTRACT(YEAR FROM NEW.leave_date);
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Update leave_rollover function
CREATE OR REPLACE FUNCTION leave_rollover()
RETURNS VOID AS $$
DECLARE
    employee_record RECORD;
    leave_type_record RECORD;
    rollover_days INTEGER;
    current_year INTEGER;
BEGIN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Get all active employees
    FOR employee_record IN
        SELECT 
            p.id as user_id,
            p.employee_category_id,
            ec.name as category_name
        FROM profiles p
        LEFT JOIN employee_categories ec ON p.employee_category_id = ec.id
        WHERE p.is_active = true
    LOOP
        -- Get all leave types
        FOR leave_type_record IN
            SELECT id, name, max_days_per_year
            FROM leave_types
            WHERE is_active = true
        LOOP
            -- Calculate rollover days (remaining days from previous year)
            SELECT COALESCE(remaining_days, 0)
            INTO rollover_days
            FROM leave_balances
            WHERE user_id = employee_record.user_id
              AND leave_type_id = leave_type_record.id
              AND year = current_year - 1;
            
            -- Add rollover days to current year balance
            IF rollover_days > 0 THEN
                UPDATE leave_balances
                SET 
                    total_days = total_days + rollover_days,
                    allocated_days = allocated_days + rollover_days,
                    remaining_days = remaining_days + rollover_days
                WHERE user_id = employee_record.user_id
                  AND leave_type_id = leave_type_record.id
                  AND year = current_year;
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Update auto_update_balances_trigger function
CREATE OR REPLACE FUNCTION auto_update_balances_trigger()
RETURNS TRIGGER AS $$
DECLARE
    employee_record RECORD;
BEGIN
    -- Get employee details
    SELECT 
        p.employee_category_id,
        ec.name as category_name
    INTO employee_record
    FROM profiles p
    LEFT JOIN employee_categories ec ON p.employee_category_id = ec.id
    WHERE p.id = NEW.user_id;
    
    -- Trigger balance refresh for the year
    PERFORM refresh_employee_leave_balances(EXTRACT(YEAR FROM NEW.start_date));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Update fix_user_id_mapping function
CREATE OR REPLACE FUNCTION fix_user_id_mapping()
RETURNS VOID AS $$
DECLARE
    employee_record RECORD;
BEGIN
    -- Update leave_balances with correct user_id
    FOR employee_record IN
        SELECT 
            p.id as user_id,
            p.employee_category_id,
            ec.name as category_name
        FROM profiles p
        LEFT JOIN employee_categories ec ON p.employee_category_id = ec.id
        WHERE p.is_active = true
    LOOP
        -- Update leave_balances
        UPDATE leave_balances
        SET user_id = employee_record.user_id
        WHERE employee_id = employee_record.user_id
          AND user_id IS NULL;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Update fix_interval_comparison function
CREATE OR REPLACE FUNCTION fix_interval_comparison()
RETURNS VOID AS $$
DECLARE
    employee_record RECORD;
    leave_type_record RECORD;
    policy_record RECORD;
BEGIN
    -- Get all employees
    FOR employee_record IN
        SELECT 
            p.id as user_id,
            p.employee_category_id,
            p.joined_on_date,
            p.probation_period_months,
            ec.name as category_name
        FROM profiles p
        LEFT JOIN employee_categories ec ON p.employee_category_id = ec.id
        WHERE p.is_active = true
    LOOP
        -- Get all leave types
        FOR leave_type_record IN
            SELECT id, name
            FROM leave_types
            WHERE is_active = true
        LOOP
            -- Find matching policy
            SELECT *
            INTO policy_record
            FROM leave_policies
            WHERE employee_category_id = employee_record.employee_category_id
              AND leave_type_id = leave_type_record.id
              AND is_active = true;
            
            -- Update leave_balances with correct policy
            IF policy_record IS NOT NULL THEN
                UPDATE leave_balances
                SET 
                    max_days_per_year = policy_record.max_days_per_year,
                    probation_max_days = policy_record.probation_max_days,
                    is_paid = policy_record.is_paid,
                    requires_approval = policy_record.requires_approval
                WHERE user_id = employee_record.user_id
                  AND leave_type_id = leave_type_record.id;
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Update fix_function_types function
CREATE OR REPLACE FUNCTION fix_function_types()
RETURNS VOID AS $$
DECLARE
    employee_record RECORD;
BEGIN
    -- Get all employees
    FOR employee_record IN
        SELECT 
            p.id as user_id,
            p.employee_category_id,
            ec.name as category_name
        FROM profiles p
        LEFT JOIN employee_categories ec ON p.employee_category_id = ec.id
        WHERE p.is_active = true
    LOOP
        -- Update leave_balances with correct types
        UPDATE leave_balances
        SET 
            allocated_days = total_days,
            remaining_days = total_days - used_days,
            probation_remaining_days = probation_allocated_days - probation_used_days
        WHERE user_id = employee_record.user_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Update fix_employee_id_column function
CREATE OR REPLACE FUNCTION fix_employee_id_column()
RETURNS VOID AS $$
DECLARE
    employee_record RECORD;
BEGIN
    -- Get all employees
    FOR employee_record IN
        SELECT 
            p.id as user_id,
            p.employee_category_id,
            ec.name as category_name
        FROM profiles p
        LEFT JOIN employee_categories ec ON p.employee_category_id = ec.id
        WHERE p.is_active = true
    LOOP
        -- Update leave_balances with correct employee_id
        UPDATE leave_balances
        SET employee_id = employee_record.user_id
        WHERE user_id = employee_record.user_id
          AND employee_id IS NULL;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Update fix_user_id_constraint function
CREATE OR REPLACE FUNCTION fix_user_id_constraint()
RETURNS VOID AS $$
DECLARE
    employee_record RECORD;
BEGIN
    -- Get all employees
    FOR employee_record IN
        SELECT 
            p.id as user_id,
            p.employee_category_id,
            ec.name as category_name
        FROM profiles p
        LEFT JOIN employee_categories ec ON p.employee_category_id = ec.id
        WHERE p.is_active = true
    LOOP
        -- Update leave_balances with correct user_id
        UPDATE leave_balances
        SET user_id = employee_record.user_id
        WHERE employee_id = employee_record.user_id
          AND user_id IS NULL;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Verify the fix
SELECT 'All functions updated successfully!' as result;
