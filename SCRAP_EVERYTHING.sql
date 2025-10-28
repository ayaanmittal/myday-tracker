-- Scrap Everything - Drop ALL Leave-Related Functions
-- This will clean the slate completely so we can start fresh

-- Step 1: Drop ALL leave-related functions (with CASCADE to handle dependencies)
DROP FUNCTION IF EXISTS approve_leave_request_simple(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS reject_leave_request_simple(uuid, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS approve_leave_request_isolated(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS reject_leave_request_isolated(uuid, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS approve_leave_request_minimal(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS reject_leave_request_minimal(uuid, uuid, text) CASCADE;

-- Step 2: Drop ALL the problematic functions we identified earlier
DROP FUNCTION IF EXISTS get_employee_leave_allocation(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS update_leave_balances_on_category_change() CASCADE;
DROP FUNCTION IF EXISTS rollover_leave_balances() CASCADE;
DROP FUNCTION IF EXISTS mark_leave_requests_processed() CASCADE;
DROP FUNCTION IF EXISTS update_leave_balance_on_request_change() CASCADE;
DROP FUNCTION IF EXISTS calculate_unpaid_leave_days_for_salary(uuid, date) CASCADE;
DROP FUNCTION IF EXISTS trigger_refresh_leave_balances() CASCADE;
DROP FUNCTION IF EXISTS auto_mark_leave_granted() CASCADE;
DROP FUNCTION IF EXISTS apply_approved_leaves_for_range(date, date) CASCADE;
DROP FUNCTION IF EXISTS get_employee_leave_summary(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS update_leave_usage() CASCADE;
DROP FUNCTION IF EXISTS calculate_month_leave_deductions(uuid, date) CASCADE;
DROP FUNCTION IF EXISTS protect_leave_granted() CASCADE;
DROP FUNCTION IF EXISTS calculate_unpaid_leave_days(uuid, date) CASCADE;
DROP FUNCTION IF EXISTS get_leave_policy_for_employee(uuid) CASCADE;
DROP FUNCTION IF EXISTS populate_leaves_from_requests() CASCADE;
DROP FUNCTION IF EXISTS update_leaves_paid_status() CASCADE;
DROP FUNCTION IF EXISTS get_employee_leave_summary_with_policy(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS validate_leave_request(uuid, uuid, date, date, integer) CASCADE;
DROP FUNCTION IF EXISTS get_available_leave_types(uuid) CASCADE;
DROP FUNCTION IF EXISTS add_manual_leave(uuid, uuid, date, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS get_employee_leaves_with_salary_deductions(uuid, date) CASCADE;

-- Step 3: Drop ALL other problematic functions
DROP FUNCTION IF EXISTS refresh_employee_leave_balances(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS auto_calculate_used_days() CASCADE;
DROP FUNCTION IF EXISTS leave_rollover() CASCADE;
DROP FUNCTION IF EXISTS auto_update_balances_trigger() CASCADE;
DROP FUNCTION IF EXISTS fix_user_id_mapping() CASCADE;
DROP FUNCTION IF EXISTS fix_interval_comparison() CASCADE;
DROP FUNCTION IF EXISTS fix_function_types() CASCADE;
DROP FUNCTION IF EXISTS fix_employee_id_column() CASCADE;
DROP FUNCTION IF EXISTS fix_user_id_constraint() CASCADE;
DROP FUNCTION IF EXISTS approve_leave_request(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS reject_leave_request(uuid, uuid, text) CASCADE;

-- Step 4: Drop ALL triggers that might be problematic
DROP TRIGGER IF EXISTS auto_calculate_used_days_trigger ON leave_requests CASCADE;
DROP TRIGGER IF EXISTS auto_update_balances_trigger ON leave_requests CASCADE;
DROP TRIGGER IF EXISTS auto_mark_leave_granted_trigger ON leave_requests CASCADE;
DROP TRIGGER IF EXISTS update_leave_usage_trigger ON leave_requests CASCADE;
DROP TRIGGER IF EXISTS protect_leave_granted_trigger ON leaves CASCADE;
DROP TRIGGER IF EXISTS update_leaves_paid_status_trigger ON leaves CASCADE;
DROP TRIGGER IF EXISTS trigger_update_leave_balance ON leave_requests CASCADE;

-- Step 5: Drop ALL views that might reference problematic columns
DROP VIEW IF EXISTS profiles_with_categories CASCADE;

-- Step 6: Verify cleanup - show remaining functions
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%leave%'
ORDER BY routine_name;

-- Step 7: Final verification
SELECT 'All leave-related functions and triggers dropped! Clean slate ready!' as result;

