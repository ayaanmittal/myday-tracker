-- Create trigger to automatically update leave balances when leave requests are approved/rejected

-- Create function to update leave balances when leave request status changes
CREATE OR REPLACE FUNCTION update_leave_balance_on_request_change()
RETURNS TRIGGER AS $$
DECLARE
    request_year INTEGER;
    employee_id UUID;
    leave_type_id UUID;
    days_change INTEGER;
BEGIN
    -- Get the year from the request
    request_year := EXTRACT(YEAR FROM COALESCE(NEW.start_date, OLD.start_date));
    employee_id := COALESCE(NEW.user_id, OLD.user_id);
    leave_type_id := COALESCE(NEW.leave_type_id, OLD.leave_type_id);
    
    -- Calculate the change in days
    IF TG_OP = 'INSERT' THEN
        -- New request approved
        IF NEW.status = 'approved' THEN
            days_change := NEW.days_requested;
        ELSE
            days_change := 0;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Status changed
        IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
            -- Request was just approved
            days_change := NEW.days_requested;
        ELSIF OLD.status = 'approved' AND NEW.status != 'approved' THEN
            -- Request was unapproved (rejected/cancelled)
            days_change := -OLD.days_requested;
        ELSIF OLD.status = 'approved' AND NEW.status = 'approved' AND OLD.days_requested != NEW.days_requested THEN
            -- Approved request days changed
            days_change := NEW.days_requested - OLD.days_requested;
        ELSE
            days_change := 0;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        -- Request deleted
        IF OLD.status = 'approved' THEN
            days_change := -OLD.days_requested;
        ELSE
            days_change := 0;
        END IF;
    END IF;
    
    -- Update the leave balance if there's a change
    IF days_change != 0 THEN
        -- Check if employee is on probation
        DECLARE
            is_on_probation BOOLEAN;
            probation_months INTEGER;
        BEGIN
            SELECT 
                COALESCE(p.probation_period_months, ec.probation_period_months, 3),
                p.joined_on_date
            INTO probation_months, is_on_probation
            FROM profiles p
            LEFT JOIN employee_categories ec ON p.employee_category = ec.name
            WHERE p.id = employee_id;
            
            is_on_probation := is_on_probation > (CURRENT_DATE - INTERVAL '1 month' * probation_months);
            
            -- Update the balance (remaining_days will be calculated automatically)
            IF is_on_probation THEN
                UPDATE leave_balances 
                SET 
                    probation_used_days = GREATEST(0, probation_used_days + days_change)
                WHERE user_id = employee_id 
                AND leave_type_id = leave_type_id 
                AND year = request_year;
            ELSE
                UPDATE leave_balances 
                SET 
                    used_days = GREATEST(0, used_days + days_change)
                WHERE user_id = employee_id 
                AND leave_type_id = leave_type_id 
                AND year = request_year;
            END IF;
        END;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on leave_requests table
DROP TRIGGER IF EXISTS trigger_update_leave_balance ON leave_requests;
CREATE TRIGGER trigger_update_leave_balance
    AFTER INSERT OR UPDATE OR DELETE ON leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_leave_balance_on_request_change();

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_leave_balance_on_request_change() TO authenticated;
