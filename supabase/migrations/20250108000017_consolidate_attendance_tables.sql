-- Consolidate attendance_logs and day_entries into a single unified table

-- Create the new unified attendance table
CREATE TABLE IF NOT EXISTS public.unified_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code TEXT, -- TeamOffice employee code (for biometric entries)
  employee_name TEXT, -- TeamOffice employee name (for biometric entries)
  entry_date DATE NOT NULL,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  total_work_time_minutes INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'absent', 'unlogged')),
  is_late BOOLEAN DEFAULT false,
  device_info TEXT NOT NULL, -- 'Manual', 'TeamOffice API', 'Biometric Device', etc.
  device_id TEXT, -- Device ID from biometric system
  source TEXT NOT NULL, -- 'manual', 'teamoffice', 'biometric'
  modification_reason TEXT,
  lunch_break_start TIMESTAMPTZ,
  lunch_break_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT check_valid_times CHECK (
    check_in_at IS NULL OR 
    check_out_at IS NULL OR 
    check_out_at > check_in_at
  ),
  CONSTRAINT check_work_time CHECK (total_work_time_minutes >= 0),
  CONSTRAINT check_lunch_break CHECK (
    lunch_break_start IS NULL OR 
    lunch_break_end IS NULL OR 
    lunch_break_end > lunch_break_start
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_unified_attendance_user_date ON public.unified_attendance(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_unified_attendance_employee_code ON public.unified_attendance(employee_code);
CREATE INDEX IF NOT EXISTS idx_unified_attendance_source ON public.unified_attendance(source);
CREATE INDEX IF NOT EXISTS idx_unified_attendance_created_at ON public.unified_attendance(created_at);

-- Create unique constraint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS ux_unified_attendance_user_date 
ON public.unified_attendance(user_id, entry_date) 
WHERE status != 'absent';

-- Migrate data from existing tables
INSERT INTO public.unified_attendance (
  user_id,
  employee_code,
  employee_name,
  entry_date,
  check_in_at,
  check_out_at,
  total_work_time_minutes,
  status,
  is_late,
  device_info,
  device_id,
  source,
  modification_reason,
  lunch_break_start,
  lunch_break_end,
  created_at,
  updated_at
)
SELECT 
  de.user_id,
  em.teamoffice_emp_code as employee_code,
  em.teamoffice_name as employee_name,
  de.entry_date,
  de.check_in_at,
  de.check_out_at,
  de.total_work_time_minutes,
  CASE 
    WHEN de.status = 'unlogged' THEN 'unlogged'
    WHEN de.status = 'in_progress' THEN 'in_progress'
    WHEN de.status = 'completed' THEN 'completed'
    WHEN de.status = 'absent' THEN 'absent'
    ELSE 'in_progress'
  END as status,
  COALESCE(de.is_late, false) as is_late,
  COALESCE(de.device_info, 'Manual') as device_info,
  NULL as device_id, -- Will be populated from attendance_logs if available
  CASE 
    WHEN de.device_info = 'TeamOffice API' THEN 'teamoffice'
    WHEN de.device_info = 'Manual' THEN 'manual'
    ELSE 'manual'
  END as source,
  de.modification_reason,
  de.lunch_break_start,
  de.lunch_break_end,
  de.created_at,
  de.updated_at
FROM day_entries de
LEFT JOIN employee_mappings em ON em.our_user_id = de.user_id
WHERE de.user_id IS NOT NULL;

-- Update device_id from attendance_logs for TeamOffice entries
UPDATE public.unified_attendance ua
SET device_id = al.device_id
FROM attendance_logs al
JOIN employee_mappings em ON em.teamoffice_emp_code = al.employee_id::text
WHERE ua.user_id = em.our_user_id
  AND ua.entry_date = al.log_time::date
  AND ua.source = 'teamoffice'
  AND al.log_type = 'checkin'
  AND al.device_id IS NOT NULL;

-- Create RLS policies
ALTER TABLE public.unified_attendance ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own attendance
CREATE POLICY "Users can view their own attendance" ON public.unified_attendance
  FOR SELECT USING (auth.uid() = user_id);

-- Policy for users to insert their own attendance
CREATE POLICY "Users can insert their own attendance" ON public.unified_attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own attendance
CREATE POLICY "Users can update their own attendance" ON public.unified_attendance
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy for admins to see all attendance
CREATE POLICY "Admins can view all attendance" ON public.unified_attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Policy for admins to insert attendance for any user
CREATE POLICY "Admins can insert attendance for any user" ON public.unified_attendance
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Policy for admins to update attendance for any user
CREATE POLICY "Admins can update attendance for any user" ON public.unified_attendance
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Policy for admins to delete attendance
CREATE POLICY "Admins can delete attendance" ON public.unified_attendance
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION public.update_unified_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_unified_attendance_updated_at
  BEFORE UPDATE ON public.unified_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_unified_attendance_updated_at();

-- Create function to process TeamOffice attendance into unified table
CREATE OR REPLACE FUNCTION public.process_teamoffice_unified_attendance(
  p_empcode TEXT,
  p_name TEXT,
  p_datestring TEXT,
  p_intime TEXT DEFAULT NULL,
  p_outtime TEXT DEFAULT NULL,
  p_worktime TEXT DEFAULT '00:00',
  p_status TEXT DEFAULT 'P',
  p_remark TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL,
  p_raw_payload JSONB DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  attendance_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_checkin_time TIMESTAMPTZ;
  v_checkout_time TIMESTAMPTZ;
  v_work_minutes INTEGER;
  v_entry_status TEXT;
  v_is_late BOOLEAN := false;
  v_attendance_id UUID;
BEGIN
  -- Get user mapping - ONLY process if mapping exists
  SELECT our_user_id, our_name INTO v_user_id, v_user_name
  FROM employee_mappings 
  WHERE teamoffice_emp_code = p_empcode
  LIMIT 1;
  
  -- Skip processing if no mapping found
  IF v_user_id IS NULL THEN
    success := false;
    message := 'No employee mapping found for code: ' || p_empcode;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Parse times if provided
  IF p_intime IS NOT NULL AND p_intime != '' THEN
    v_checkin_time := to_timestamp(p_datestring || ' ' || p_intime, 'DD/MM/YYYY HH24:MI');
  END IF;
  
  IF p_outtime IS NOT NULL AND p_outtime != '' THEN
    v_checkout_time := to_timestamp(p_datestring || ' ' || p_outtime, 'DD/MM/YYYY HH24:MI');
  END IF;
  
  -- Convert work time to minutes
  v_work_minutes := EXTRACT(HOUR FROM to_timestamp(p_worktime, 'HH24:MI')) * 60 + 
                   EXTRACT(MINUTE FROM to_timestamp(p_worktime, 'HH24:MI'));
  
  -- Determine status
  v_entry_status := CASE 
    WHEN p_outtime IS NOT NULL AND p_outtime != '' THEN 'completed'
    WHEN p_intime IS NOT NULL AND p_intime != '' THEN 'in_progress'
    ELSE 'in_progress'
  END;
  
  -- Check if check-in is late
  IF v_checkin_time IS NOT NULL THEN
    v_is_late := COALESCE(
      (SELECT result FROM is_checkin_late(v_checkin_time::date, v_checkin_time::time)),
      false
    );
  END IF;
  
  -- Insert or update attendance record
  INSERT INTO unified_attendance (
    user_id,
    employee_code,
    employee_name,
    entry_date,
    check_in_at,
    check_out_at,
    total_work_time_minutes,
    status,
    is_late,
    device_info,
    device_id,
    source,
    modification_reason
  ) VALUES (
    v_user_id,
    p_empcode,
    p_name,
    v_checkin_time::date,
    v_checkin_time,
    v_checkout_time,
    v_work_minutes,
    v_entry_status,
    v_is_late,
    'TeamOffice API',
    p_device_id,
    'teamoffice',
    CASE WHEN p_remark IS NOT NULL THEN 'TeamOffice: ' || p_remark ELSE NULL END
  )
  ON CONFLICT (user_id, entry_date) 
  DO UPDATE SET
    check_in_at = CASE 
      WHEN EXCLUDED.check_in_at IS NOT NULL THEN EXCLUDED.check_in_at
      ELSE unified_attendance.check_in_at
    END,
    check_out_at = CASE 
      WHEN EXCLUDED.check_out_at IS NOT NULL THEN EXCLUDED.check_out_at
      ELSE unified_attendance.check_out_at
    END,
    total_work_time_minutes = CASE 
      WHEN EXCLUDED.check_out_at IS NOT NULL AND EXCLUDED.check_in_at IS NOT NULL THEN EXCLUDED.total_work_time_minutes
      ELSE unified_attendance.total_work_time_minutes
    END,
    status = CASE 
      WHEN EXCLUDED.check_out_at IS NOT NULL THEN 'completed'
      WHEN EXCLUDED.check_in_at IS NOT NULL THEN 'in_progress'
      ELSE unified_attendance.status
    END,
    is_late = CASE 
      WHEN EXCLUDED.check_in_at IS NOT NULL THEN EXCLUDED.is_late
      ELSE unified_attendance.is_late
    END,
    device_info = 'TeamOffice API',
    device_id = COALESCE(EXCLUDED.device_id, unified_attendance.device_id),
    source = 'teamoffice',
    modification_reason = CASE 
      WHEN EXCLUDED.modification_reason IS NOT NULL THEN EXCLUDED.modification_reason
      ELSE unified_attendance.modification_reason
    END,
    updated_at = now()
  RETURNING id INTO v_attendance_id;
  
  success := true;
  message := 'Successfully processed attendance for ' || v_user_name;
  attendance_id := v_attendance_id;
  RETURN NEXT;
  RETURN;
END;
$$;

-- Show migration summary
DO $$
DECLARE
  day_entries_count INTEGER;
  attendance_logs_count INTEGER;
  unified_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO day_entries_count FROM day_entries;
  SELECT COUNT(*) INTO attendance_logs_count FROM attendance_logs;
  SELECT COUNT(*) INTO unified_count FROM unified_attendance;
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  day_entries records: %', day_entries_count;
  RAISE NOTICE '  attendance_logs records: %', attendance_logs_count;
  RAISE NOTICE '  unified_attendance records: %', unified_count;
  RAISE NOTICE 'Migration completed successfully!';
END $$;
