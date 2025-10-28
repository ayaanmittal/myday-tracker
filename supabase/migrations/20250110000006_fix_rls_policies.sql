-- Fix RLS policies for leave system tables

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON employee_categories;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON employee_categories;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON employee_categories;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON employee_categories;

DROP POLICY IF EXISTS "Enable read access for all users" ON leave_types;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON leave_types;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON leave_types;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON leave_types;

DROP POLICY IF EXISTS "Enable read access for all users" ON leave_policies;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON leave_policies;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON leave_policies;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON leave_policies;

DROP POLICY IF EXISTS "Enable read access for all users" ON leave_balances;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON leave_balances;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON leave_balances;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON leave_balances;

-- Enable RLS on tables
ALTER TABLE employee_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies for employee_categories
CREATE POLICY "employee_categories_select_policy" ON employee_categories
    FOR SELECT USING (true);

CREATE POLICY "employee_categories_insert_policy" ON employee_categories
    FOR INSERT WITH CHECK (true);

CREATE POLICY "employee_categories_update_policy" ON employee_categories
    FOR UPDATE USING (true);

CREATE POLICY "employee_categories_delete_policy" ON employee_categories
    FOR DELETE USING (true);

-- Create comprehensive RLS policies for leave_types
CREATE POLICY "leave_types_select_policy" ON leave_types
    FOR SELECT USING (true);

CREATE POLICY "leave_types_insert_policy" ON leave_types
    FOR INSERT WITH CHECK (true);

CREATE POLICY "leave_types_update_policy" ON leave_types
    FOR UPDATE USING (true);

CREATE POLICY "leave_types_delete_policy" ON leave_types
    FOR DELETE USING (true);

-- Create comprehensive RLS policies for leave_policies
CREATE POLICY "leave_policies_select_policy" ON leave_policies
    FOR SELECT USING (true);

CREATE POLICY "leave_policies_insert_policy" ON leave_policies
    FOR INSERT WITH CHECK (true);

CREATE POLICY "leave_policies_update_policy" ON leave_policies
    FOR UPDATE USING (true);

CREATE POLICY "leave_policies_delete_policy" ON leave_policies
    FOR DELETE USING (true);

-- Create comprehensive RLS policies for leave_balances
CREATE POLICY "leave_balances_select_policy" ON leave_balances
    FOR SELECT USING (true);

CREATE POLICY "leave_balances_insert_policy" ON leave_balances
    FOR INSERT WITH CHECK (true);

CREATE POLICY "leave_balances_update_policy" ON leave_balances
    FOR UPDATE USING (true);

CREATE POLICY "leave_balances_delete_policy" ON leave_balances
    FOR DELETE USING (true);

-- Grant necessary permissions
GRANT ALL ON employee_categories TO authenticated;
GRANT ALL ON leave_types TO authenticated;
GRANT ALL ON leave_policies TO authenticated;
GRANT ALL ON leave_balances TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year ON leave_balances(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_leave_balances_leave_type ON leave_balances(leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_policies_category ON leave_policies(employee_category_id);
CREATE INDEX IF NOT EXISTS idx_leave_policies_leave_type ON leave_policies(leave_type_id);

-- Update the profiles table to ensure the new columns exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS employee_category TEXT DEFAULT 'permanent',
ADD COLUMN IF NOT EXISTS joined_on_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS probation_period_months INTEGER DEFAULT 3;

-- Create a function to get employee category ID by name
CREATE OR REPLACE FUNCTION get_employee_category_id(category_name TEXT)
RETURNS UUID AS $$
DECLARE
    category_id UUID;
BEGIN
    SELECT id INTO category_id 
    FROM employee_categories 
    WHERE name = category_name;
    
    RETURN category_id;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get leave type ID by name
CREATE OR REPLACE FUNCTION get_leave_type_id(type_name TEXT)
RETURNS UUID AS $$
DECLARE
    type_id UUID;
BEGIN
    SELECT id INTO type_id 
    FROM leave_types 
    WHERE name = type_name;
    
    RETURN type_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_employee_category_id(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_leave_type_id(TEXT) TO authenticated;


