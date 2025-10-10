-- Add late tracking to day_entries table
ALTER TABLE public.day_entries 
ADD COLUMN is_late BOOLEAN NOT NULL DEFAULT false;

-- Add index for better performance on late queries
CREATE INDEX IF NOT EXISTS idx_day_entries_is_late ON public.day_entries(is_late);

-- Create function to check if check-in time is late
CREATE OR REPLACE FUNCTION public.is_checkin_late(
  checkin_time TIMESTAMPTZ,
  workday_start_time TEXT DEFAULT '10:30',
  late_threshold_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  checkin_date DATE;
  expected_start_time TIMESTAMPTZ;
  late_threshold_time TIMESTAMPTZ;
BEGIN
  -- Extract date from checkin_time
  checkin_date := checkin_time::DATE;
  
  -- Create expected start time for that date
  expected_start_time := checkin_date || ' ' || workday_start_time;
  
  -- Calculate late threshold time
  late_threshold_time := expected_start_time + (late_threshold_minutes || ' minutes')::INTERVAL;
  
  -- Return true if checkin_time is after the late threshold
  RETURN checkin_time > late_threshold_time;
END;
$$;

-- Create function to update late status for existing entries
CREATE OR REPLACE FUNCTION public.update_late_status_for_entries()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  workday_start_setting TEXT;
  late_threshold_setting INTEGER;
BEGIN
  -- Get settings from settings table
  SELECT value INTO workday_start_setting
  FROM public.settings 
  WHERE key = 'workday_start_time' 
  LIMIT 1;
  
  SELECT value::INTEGER INTO late_threshold_setting
  FROM public.settings 
  WHERE key = 'late_threshold_minutes' 
  LIMIT 1;
  
  -- Use defaults if settings not found
  workday_start_setting := COALESCE(workday_start_setting, '10:30');
  late_threshold_setting := COALESCE(late_threshold_setting, 15);
  
  -- Update all day_entries with late status
  UPDATE public.day_entries 
  SET is_late = public.is_checkin_late(check_in_at, workday_start_setting, late_threshold_setting)
  WHERE check_in_at IS NOT NULL;
END;
$$;

-- Run the update function to set late status for existing entries
SELECT public.update_late_status_for_entries();
