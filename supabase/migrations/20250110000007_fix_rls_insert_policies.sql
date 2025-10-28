-- Fix RLS policies to allow inserts and updates

-- Drop existing policies
DROP POLICY IF EXISTS "employee_categories_select_policy" ON employee_categories;
DROP POLICY IF EXISTS "employee_categories_insert_policy" ON employee_categories;
DROP POLICY IF EXISTS "employee_categories_update_policy" ON employee_categories;
DROP POLICY IF EXISTS "employee_categories_delete_policy" ON employee_categories;

DROP POLICY IF EXISTS "leave_types_select_policy" ON leave_types;
DROP POLICY IF EXISTS "leave_types_insert_policy" ON leave_types;
DROP POLICY IF EXISTS "leave_types_update_policy" ON leave_types;
DROP POLICY IF EXISTS "leave_types_delete_policy" ON leave_types;

DROP POLICY IF EXISTS "leave_policies_select_policy" ON leave_policies;
DROP POLICY IF EXISTS "leave_policies_insert_policy" ON leave_policies;
DROP POLICY IF EXISTS "leave_policies_update_policy" ON leave_policies;
DROP POLICY IF EXISTS "leave_policies_delete_policy" ON leave_policies;

DROP POLICY IF EXISTS "leave_balances_select_policy" ON leave_balances;
DROP POLICY IF EXISTS "leave_balances_insert_policy" ON leave_balances;
DROP POLICY IF EXISTS "leave_balances_update_policy" ON leave_balances;
DROP POLICY IF EXISTS "leave_balances_delete_policy" ON leave_balances;

-- Create new policies that allow all operations for authenticated users
CREATE POLICY "employee_categories_all_policy" ON employee_categories
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "leave_types_all_policy" ON leave_types
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "leave_policies_all_policy" ON leave_policies
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "leave_balances_all_policy" ON leave_balances
    FOR ALL USING (true) WITH CHECK (true);

-- Grant all permissions
GRANT ALL ON employee_categories TO authenticated;
GRANT ALL ON leave_types TO authenticated;
GRANT ALL ON leave_policies TO authenticated;
GRANT ALL ON leave_balances TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

