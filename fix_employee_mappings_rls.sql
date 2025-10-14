-- Fix RLS policies for employee_mappings table
-- Allow authenticated users to read employee mappings

-- First, check if RLS is enabled on the table
-- ALTER TABLE public.employee_mappings ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Allow authenticated users to read employee mappings" ON public.employee_mappings;
DROP POLICY IF EXISTS "Allow authenticated users to insert employee mappings" ON public.employee_mappings;
DROP POLICY IF EXISTS "Allow authenticated users to update employee mappings" ON public.employee_mappings;
DROP POLICY IF EXISTS "Allow service role full access to employee mappings" ON public.employee_mappings;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.employee_mappings;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.employee_mappings;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.employee_mappings;

-- Create comprehensive policies
CREATE POLICY "Enable read access for all users" 
ON public.employee_mappings 
FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for authenticated users only" 
ON public.employee_mappings 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Enable update for users based on email" 
ON public.employee_mappings 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Also allow service role to do everything
CREATE POLICY "Allow service role full access to employee mappings" 
ON public.employee_mappings 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);
