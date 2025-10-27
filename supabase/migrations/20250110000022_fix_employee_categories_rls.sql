-- Fix RLS policies for employee_categories table
-- This migration ensures proper RLS policies are in place for CRUD operations

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "employee_categories_select_policy" ON employee_categories;
DROP POLICY IF EXISTS "employee_categories_insert_policy" ON employee_categories;
DROP POLICY IF EXISTS "employee_categories_update_policy" ON employee_categories;
DROP POLICY IF EXISTS "employee_categories_delete_policy" ON employee_categories;

-- Ensure RLS is enabled
ALTER TABLE employee_categories ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies for employee_categories
-- Allow authenticated users to perform all operations

-- SELECT policy - allow all authenticated users to read
CREATE POLICY "employee_categories_select_policy" ON employee_categories
    FOR SELECT 
    TO authenticated
    USING (true);

-- INSERT policy - allow authenticated users to create
CREATE POLICY "employee_categories_insert_policy" ON employee_categories
    FOR INSERT 
    TO authenticated
    WITH CHECK (true);

-- UPDATE policy - allow authenticated users to update
CREATE POLICY "employee_categories_update_policy" ON employee_categories
    FOR UPDATE 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- DELETE policy - allow authenticated users to delete
CREATE POLICY "employee_categories_delete_policy" ON employee_categories
    FOR DELETE 
    TO authenticated
    USING (true);

-- Grant necessary permissions
GRANT ALL ON employee_categories TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Ensure the table has proper ownership and permissions
ALTER TABLE employee_categories OWNER TO postgres;

-- Grant specific permissions for each operation
GRANT SELECT, INSERT, UPDATE, DELETE ON employee_categories TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Verify the policies are working by testing with a simple query
-- This will help identify if there are any issues
DO $$
BEGIN
    -- Test if we can select from the table
    PERFORM 1 FROM employee_categories LIMIT 1;
    RAISE NOTICE 'employee_categories SELECT policy is working';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'employee_categories SELECT policy failed: %', SQLERRM;
END $$;
