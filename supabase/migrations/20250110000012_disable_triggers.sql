-- Disable triggers that might be causing the function call issue

-- Drop any existing triggers that call refresh_employee_leave_balances
DROP TRIGGER IF EXISTS refresh_balances_on_employee_change ON profiles;
DROP TRIGGER IF EXISTS refresh_balances_on_policy_change ON leave_policies;
DROP TRIGGER IF EXISTS refresh_balances_on_category_change ON employee_categories;

-- Drop the trigger function
DROP FUNCTION IF EXISTS trigger_refresh_leave_balances();

-- Recreate the function with proper type handling
CREATE OR REPLACE FUNCTION trigger_refresh_leave_balances()
RETURNS TRIGGER AS $$
BEGIN
    -- Only refresh if the change affects leave calculations
    IF TG_OP = 'UPDATE' AND (
        OLD.employee_category IS DISTINCT FROM NEW.employee_category OR
        OLD.joined_on_date IS DISTINCT FROM NEW.joined_on_date OR
        OLD.probation_period_months IS DISTINCT FROM NEW.probation_period_months
    ) THEN
        -- Call the function with proper INTEGER type
        PERFORM refresh_employee_leave_balances(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger with proper type handling
CREATE TRIGGER refresh_balances_on_employee_change
    AFTER UPDATE OF employee_category, joined_on_date, probation_period_months ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_leave_balances();

-- Also create triggers for policy and category changes
CREATE TRIGGER refresh_balances_on_policy_change
    AFTER INSERT OR UPDATE OR DELETE ON leave_policies
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_leave_balances();

CREATE TRIGGER refresh_balances_on_category_change
    AFTER INSERT OR UPDATE OR DELETE ON employee_categories
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_leave_balances();
