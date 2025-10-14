-- Manual SQL script to add holiday status
-- Run this in Supabase SQL Editor

-- First, update the status constraint to include 'holiday'
ALTER TABLE public.unified_attendance 
DROP CONSTRAINT IF EXISTS unified_attendance_status_check;

ALTER TABLE public.unified_attendance 
ADD CONSTRAINT unified_attendance_status_check 
CHECK (status IN ('in_progress', 'completed', 'absent', 'holiday'));

-- Update the trigger function to handle holiday status
CREATE OR REPLACE FUNCTION update_attendance_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If check_out_at is set and status is in_progress, change to completed
  IF NEW.check_out_at IS NOT NULL AND NEW.status = 'in_progress' THEN
    NEW.status := 'completed';
  END IF;
  
  -- If check_out_at is NULL and status is completed, change to in_progress
  IF NEW.check_out_at IS NULL AND NEW.status = 'completed' THEN
    NEW.status := 'in_progress';
  END IF;
  
  -- If both check_in_at and check_out_at are NULL, status should be absent
  IF NEW.check_in_at IS NULL AND NEW.check_out_at IS NULL THEN
    NEW.status := 'absent';
  END IF;
  
  -- If check_in_at exists but check_out_at is NULL, status should be in_progress
  IF NEW.check_in_at IS NOT NULL AND NEW.check_out_at IS NULL THEN
    NEW.status := 'in_progress';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Test the constraint by trying to insert a holiday record
INSERT INTO public.unified_attendance (
  user_id,
  entry_date,
  status,
  device_info,
  source,
  modification_reason
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  CURRENT_DATE,
  'holiday',
  'Test',
  'manual',
  'Testing holiday status'
) ON CONFLICT DO NOTHING;

-- Clean up test record
DELETE FROM public.unified_attendance 
WHERE modification_reason = 'Testing holiday status';

-- Show success message
SELECT 'Holiday status added successfully!' as message;
