-- Fix RLS policies for leave_requests table

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can insert their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can update their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can delete their own leave requests" ON public.leave_requests;

-- Create comprehensive RLS policies for leave_requests
CREATE POLICY "Authenticated users can view leave requests" ON public.leave_requests
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert leave requests" ON public.leave_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update leave requests" ON public.leave_requests
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete leave requests" ON public.leave_requests
    FOR DELETE
    TO authenticated
    USING (true);

-- Grant permissions
GRANT ALL ON public.leave_requests TO authenticated;
