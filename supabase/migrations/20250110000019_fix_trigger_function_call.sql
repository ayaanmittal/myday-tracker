-- Fix trigger function call to use proper INTEGER type

-- Drop all dependent triggers first
DROP TRIGGER IF EXISTS refresh_balances_on_employee_change ON profiles;
DROP TRIGGER IF EXISTS refresh_balances_on_policy_change ON leave_policies;
DROP TRIGGER IF EXISTS refresh_balances_on_category_change ON employee_categories;

-- Drop the existing trigger function
DROP FUNCTION IF EXISTS trigger_refresh_leave_balances();

-- Recreate the function with proper INTEGER handling
CREATE OR REPLACE FUNCTION trigger_refresh_leave_balances()
RETURNS TRIGGER AS $$
DECLARE
    current_year INTEGER;
BEGIN
    -- Only refresh if the change affects leave calculations
    IF TG_OP = 'UPDATE' AND (
        OLD.employee_category IS DISTINCT FROM NEW.employee_category OR
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

-- Recreate all triggers
CREATE TRIGGER refresh_balances_on_employee_change
    AFTER UPDATE OF employee_category, joined_on_date, probation_period_months ON profiles
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
