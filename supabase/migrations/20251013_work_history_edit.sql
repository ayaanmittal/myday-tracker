-- Add fields for manual work history editing
ALTER TABLE public.unified_attendance 
ADD COLUMN IF NOT EXISTS manual_status VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS manual_override_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS manual_override_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS manual_override_reason TEXT DEFAULT NULL;

-- Add check constraint for manual_status values
ALTER TABLE public.unified_attendance 
ADD CONSTRAINT check_manual_status 
CHECK (manual_status IS NULL OR manual_status IN ('present', 'absent', 'leave_granted'));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_unified_attendance_manual_status 
ON public.unified_attendance(manual_status) 
WHERE manual_status IS NOT NULL;

-- Create function to automatically mark leave granted days
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

-- Create trigger to auto-mark leave granted days
DROP TRIGGER IF EXISTS trigger_auto_mark_leave_granted ON public.unified_attendance;
CREATE TRIGGER trigger_auto_mark_leave_granted
  BEFORE INSERT OR UPDATE ON public.unified_attendance
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_leave_granted();

-- Create function to get work history with manual overrides
CREATE OR REPLACE FUNCTION get_work_history_with_overrides(
  target_user_id UUID,
  start_date DATE,
  end_date DATE
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  entry_date DATE,
  check_in_at TIMESTAMP WITH TIME ZONE,
  check_out_at TIMESTAMP WITH TIME ZONE,
  total_work_time_minutes INTEGER,
  status TEXT,
  manual_status TEXT,
  manual_override_by UUID,
  manual_override_at TIMESTAMP WITH TIME ZONE,
  manual_override_reason TEXT,
  is_late BOOLEAN,
  device_info TEXT,
  modification_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    de.id,
    de.user_id,
    de.entry_date,
    de.check_in_at,
    de.check_out_at,
    de.total_work_time_minutes,
    CASE 
      WHEN de.manual_status IS NOT NULL THEN de.manual_status
      ELSE de.status
    END as status,
    de.manual_status,
    de.manual_override_by,
    de.manual_override_at,
    de.manual_override_reason,
    de.is_late,
    de.device_info,
    de.modification_reason,
    de.created_at,
    de.updated_at
  FROM public.unified_attendance de
  WHERE de.user_id = target_user_id
    AND de.entry_date >= start_date
    AND de.entry_date <= end_date
  ORDER BY de.entry_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_work_history_with_overrides(UUID, DATE, DATE) TO authenticated;

-- Create RLS policy for manual override fields
CREATE POLICY "Allow admins to update manual status" ON public.unified_attendance
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Update existing RLS policy to allow admins to view all entries
CREATE POLICY "Allow admins to view all unified attendance" ON public.unified_attendance
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );
