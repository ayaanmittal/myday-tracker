-- Fix manual_status constraint to include 'holiday'
-- This migration updates the check_manual_status constraint to allow 'holiday' as a valid value

-- Drop the existing constraint
ALTER TABLE public.unified_attendance 
DROP CONSTRAINT IF EXISTS check_manual_status;

-- Add the updated constraint with 'holiday' included
ALTER TABLE public.unified_attendance 
ADD CONSTRAINT check_manual_status 
CHECK (manual_status IS NULL OR manual_status IN ('present', 'absent', 'leave_granted', 'holiday'));

-- Update the auto_mark_leave_granted function to handle holiday status
CREATE OR REPLACE FUNCTION auto_mark_leave_granted()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if there's an approved leave request for this date
  IF EXISTS (
    SELECT 1 FROM public.leave_requests lr
    WHERE lr.user_id = NEW.user_id
    AND lr.status = 'approved'
    AND lr.start_date <= NEW.entry_date
    AND lr.end_date >= NEW.entry_date
    AND (NEW.manual_status IS NULL OR NEW.manual_status = 'present')
  ) THEN
    -- Auto-mark as leave granted
    NEW.manual_status := 'leave_granted';
    NEW.manual_override_by := NEW.manual_override_by; -- Keep existing override user
    NEW.manual_override_at := COALESCE(NEW.manual_override_at, NOW());
    NEW.manual_override_reason := COALESCE(NEW.manual_override_reason, 'Auto-marked due to approved leave request');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Test the constraint by trying to insert a holiday record
DO $$
BEGIN
  -- This will test if the constraint works
  INSERT INTO public.unified_attendance (
    user_id,
    entry_date,
    status,
    manual_status,
    device_info,
    source,
    modification_reason
  ) VALUES (
    (SELECT id FROM auth.users LIMIT 1),
    CURRENT_DATE,
    'holiday',
    'holiday',
    'Test',
    'manual',
    'Testing holiday manual status'
  ) ON CONFLICT DO NOTHING;
  
  -- Clean up test record
  DELETE FROM public.unified_attendance 
  WHERE modification_reason = 'Testing holiday manual status';
  
  RAISE NOTICE 'Manual status constraint updated successfully - holiday status is now allowed';
END $$;
