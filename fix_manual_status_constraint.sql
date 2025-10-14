-- Quick fix for manual_status constraint to include 'holiday'
-- Run this in Supabase SQL Editor

-- Drop the existing constraint
ALTER TABLE public.unified_attendance 
DROP CONSTRAINT IF EXISTS check_manual_status;

-- Add the updated constraint with 'holiday' included
ALTER TABLE public.unified_attendance 
ADD CONSTRAINT check_manual_status 
CHECK (manual_status IS NULL OR manual_status IN ('present', 'absent', 'leave_granted', 'holiday'));

-- Test the constraint
SELECT 'Manual status constraint updated successfully - holiday status is now allowed' as message;
