-- Add 'unlogged' status to day_entries if not exists
-- First, check if we need to update the check constraint for status

-- Drop existing check constraint if exists
ALTER TABLE public.day_entries DROP CONSTRAINT IF EXISTS day_entries_status_check;

-- Add new check constraint with unlogged status
ALTER TABLE public.day_entries 
ADD CONSTRAINT day_entries_status_check 
CHECK (status IN ('not_started', 'in_progress', 'completed', 'unlogged'));

-- Create function to mark unlogged days for all active employees
CREATE OR REPLACE FUNCTION public.mark_unlogged_days()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For each active employee, check if they have an entry for yesterday
  -- If not, create one with status 'unlogged'
  INSERT INTO public.day_entries (user_id, entry_date, status)
  SELECT 
    p.id,
    CURRENT_DATE - INTERVAL '1 day' AS entry_date,
    'unlogged'::text AS status
  FROM public.profiles p
  WHERE p.is_active = true
    AND NOT EXISTS (
      SELECT 1 
      FROM public.day_entries de 
      WHERE de.user_id = p.id 
        AND de.entry_date = CURRENT_DATE - INTERVAL '1 day'
    );
END;
$$;

-- Create function to mark unlogged days for a specific date range
CREATE OR REPLACE FUNCTION public.mark_unlogged_days_range(start_date date, end_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_day date;
BEGIN
  current_day := start_date;
  
  WHILE current_day <= end_date LOOP
    -- Skip weekends (Saturday = 6, Sunday = 0)
    IF EXTRACT(DOW FROM current_day) NOT IN (0, 6) THEN
      INSERT INTO public.day_entries (user_id, entry_date, status)
      SELECT 
        p.id,
        current_day,
        'unlogged'::text
      FROM public.profiles p
      WHERE p.is_active = true
        AND NOT EXISTS (
          SELECT 1 
          FROM public.day_entries de 
          WHERE de.user_id = p.id 
            AND de.entry_date = current_day
        );
    END IF;
    
    current_day := current_day + INTERVAL '1 day';
  END LOOP;
END;
$$;