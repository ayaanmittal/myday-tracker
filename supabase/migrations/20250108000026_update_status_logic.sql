-- Update status logic: if check_out_at exists, status should be 'completed'
-- This migration updates existing records and creates a trigger for future updates

-- First, update existing records where check_out_at exists but status is still 'in_progress'
UPDATE public.unified_attendance 
SET status = 'completed'
WHERE check_out_at IS NOT NULL 
  AND status = 'in_progress';

-- Create a function to automatically update status based on check-out time
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

-- Create trigger to automatically update status on insert/update
DROP TRIGGER IF EXISTS trigger_update_attendance_status ON public.unified_attendance;

CREATE TRIGGER trigger_update_attendance_status
  BEFORE INSERT OR UPDATE ON public.unified_attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_status();

-- Also create a function to manually update status for existing records
CREATE OR REPLACE FUNCTION fix_attendance_status()
RETURNS void AS $$
BEGIN
  -- Update all records based on their check-in/out times
  UPDATE public.unified_attendance 
  SET status = CASE
    WHEN check_in_at IS NULL AND check_out_at IS NULL THEN 'absent'
    WHEN check_in_at IS NOT NULL AND check_out_at IS NULL THEN 'in_progress'
    WHEN check_in_at IS NOT NULL AND check_out_at IS NOT NULL THEN 'completed'
    ELSE status
  END;
  
  RAISE NOTICE 'Updated attendance status for all records based on check-in/out times';
END;
$$ LANGUAGE plpgsql;

-- Run the function to fix all existing records
SELECT fix_attendance_status();

