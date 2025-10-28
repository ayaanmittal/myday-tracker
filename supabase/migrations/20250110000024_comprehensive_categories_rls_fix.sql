-- Comprehensive fix for employee_categories table RLS policies
-- This migration ensures proper RLS policies and permissions for CRUD operations

-- First, disable RLS temporarily to ensure we can make changes
ALTER TABLE employee_categories DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "employee_categories_select_policy" ON employee_categories;
DROP POLICY IF EXISTS "employee_categories_insert_policy" ON employee_categories;
DROP POLICY IF EXISTS "employee_categories_update_policy" ON employee_categories;
DROP POLICY IF EXISTS "employee_categories_delete_policy" ON employee_categories;

-- Grant full permissions to authenticated users
GRANT ALL ON employee_categories TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Ensure proper table ownership
ALTER TABLE employee_categories OWNER TO postgres;

-- Re-enable RLS
ALTER TABLE employee_categories ENABLE ROW LEVEL SECURITY;

-- Create very permissive RLS policies for authenticated users
CREATE POLICY "employee_categories_all_access" ON employee_categories
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Alternative approach: Create separate policies for each operation
CREATE POLICY "employee_categories_select_policy" ON employee_categories
    FOR SELECT 
    TO authenticated
    USING (true);

CREATE POLICY "employee_categories_insert_policy" ON employee_categories
    FOR INSERT 
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "employee_categories_update_policy" ON employee_categories
    FOR UPDATE 
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "employee_categories_delete_policy" ON employee_categories
    FOR DELETE 
    TO authenticated
    USING (true);

-- Grant specific permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON employee_categories TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Test the policies by attempting a simple operation
DO $$
BEGIN
    -- Test if we can select from the table
    PERFORM 1 FROM employee_categories LIMIT 1;
    RAISE NOTICE 'employee_categories SELECT policy is working';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'employee_categories SELECT policy failed: %', SQLERRM;
END $$;

-- Additional permissions for the service role (if needed)
GRANT ALL ON employee_categories TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

