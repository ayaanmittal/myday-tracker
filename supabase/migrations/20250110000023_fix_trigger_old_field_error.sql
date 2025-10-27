-- Fix trigger function to handle missing employee_category_id field in OLD record
-- This migration updates the trigger function to safely handle cases where OLD record doesn't have employee_category_id

-- Drop all dependent triggers first
DROP TRIGGER IF EXISTS refresh_balances_on_employee_change ON profiles;
DROP TRIGGER IF EXISTS refresh_balances_on_policy_change ON leave_policies;
DROP TRIGGER IF EXISTS refresh_balances_on_category_change ON employee_categories;

-- Drop the existing trigger function
DROP FUNCTION IF EXISTS trigger_refresh_leave_balances();

-- Recreate the trigger function with comprehensive field existence handling
CREATE OR REPLACE FUNCTION trigger_refresh_leave_balances()
RETURNS TRIGGER AS $$
DECLARE
    current_year INTEGER;
    old_category_id UUID;
    new_category_id UUID;
    old_joined_date DATE;
    new_joined_date DATE;
    old_probation_months INTEGER;
    new_probation_months INTEGER;
    fields_changed BOOLEAN := FALSE;
BEGIN
    -- Only refresh if the change affects leave calculations
    IF TG_OP = 'UPDATE' THEN
        -- Safely get all potentially missing fields from OLD record
        BEGIN
            old_category_id := OLD.employee_category_id;
        EXCEPTION
            WHEN undefined_column THEN
                old_category_id := NULL;
        END;
        
        BEGIN
            old_joined_date := OLD.joined_on_date;
        EXCEPTION
            WHEN undefined_column THEN
                old_joined_date := NULL;
        END;
        
        BEGIN
            old_probation_months := OLD.probation_period_months;
        EXCEPTION
            WHEN undefined_column THEN
                old_probation_months := NULL;
        END;
        
        -- Safely get all fields from NEW record
        BEGIN
            new_category_id := NEW.employee_category_id;
        EXCEPTION
            WHEN undefined_column THEN
                new_category_id := NULL;
        END;
        
        BEGIN
            new_joined_date := NEW.joined_on_date;
        EXCEPTION
            WHEN undefined_column THEN
                new_joined_date := NULL;
        END;
        
        BEGIN
            new_probation_months := NEW.probation_period_months;
        EXCEPTION
            WHEN undefined_column THEN
                new_probation_months := NULL;
        END;
        
        -- Check if any relevant fields have changed
        IF (
            old_category_id IS DISTINCT FROM new_category_id OR
            old_joined_date IS DISTINCT FROM new_joined_date OR
            old_probation_months IS DISTINCT FROM new_probation_months
        ) THEN
            fields_changed := TRUE;
        END IF;
        
        -- Only refresh if fields actually changed
        IF fields_changed THEN
            -- Get current year as proper INTEGER
            current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
            
            -- Call the function with proper INTEGER type
            PERFORM refresh_employee_leave_balances(current_year);
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Recreate all triggers
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION trigger_refresh_leave_balances() TO authenticated;
