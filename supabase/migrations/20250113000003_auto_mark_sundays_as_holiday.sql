-- Auto-mark all Sundays as Holiday unless they have actual check-in/check-out times
-- This migration updates existing Sunday entries and creates a trigger for future entries

-- First, update existing Sunday entries to 'holiday' status
-- Only if they don't have both check_in_at and check_out_at
UPDATE public.unified_attendance 
SET 
    status = 'holiday',
    modification_reason = COALESCE(modification_reason, '') || '; Auto-marked as holiday (Sunday)',
    updated_at = NOW()
WHERE 
    EXTRACT(DOW FROM entry_date) = 0  -- Sunday is 0
    AND status != 'holiday'  -- Don't update already marked holidays
    AND NOT (check_in_at IS NOT NULL AND check_out_at IS NOT NULL);  -- Don't update if has both check-in and check-out

-- Update manual_status for Sunday entries that were manually marked as absent
UPDATE public.unified_attendance 
SET 
    manual_status = 'holiday',
    manual_override_reason = COALESCE(manual_override_reason, '') || '; Updated to holiday (Sunday)',
    updated_at = NOW()
WHERE 
    EXTRACT(DOW FROM entry_date) = 0  -- Sunday is 0
    AND manual_status = 'absent'  -- Only update manually marked absent entries
    AND NOT (check_in_at IS NOT NULL AND check_out_at IS NOT NULL);  -- Don't update if has both check-in and check-out

-- Create a function to auto-mark Sundays as holiday
CREATE OR REPLACE FUNCTION auto_mark_sundays_as_holiday()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is a Sunday
  IF EXTRACT(DOW FROM NEW.entry_date) = 0 THEN
    -- Only mark as holiday if there's no actual check-in/check-out
    IF NOT (NEW.check_in_at IS NOT NULL AND NEW.check_out_at IS NOT NULL) THEN
      NEW.status := 'holiday';
      NEW.modification_reason := COALESCE(NEW.modification_reason, '') || '; Auto-marked as holiday (Sunday)';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-mark Sundays as holiday on insert/update
DROP TRIGGER IF EXISTS trigger_auto_mark_sundays_as_holiday ON public.unified_attendance;
CREATE TRIGGER trigger_auto_mark_sundays_as_holiday
  BEFORE INSERT OR UPDATE ON public.unified_attendance
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_sundays_as_holiday();

-- Create a function to get Sunday work days count
CREATE OR REPLACE FUNCTION get_sunday_work_days_count(
    user_id_param UUID,
    start_date_param DATE,
    end_date_param DATE
)
RETURNS INTEGER AS $$
DECLARE
    sunday_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO sunday_count
    FROM public.unified_attendance
    WHERE user_id = user_id_param
    AND entry_date BETWEEN start_date_param AND end_date_param
    AND EXTRACT(DOW FROM entry_date) = 0  -- Sunday
    AND check_in_at IS NOT NULL 
    AND check_out_at IS NOT NULL;  -- Only count Sundays with actual work
    
    RETURN sunday_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get holiday count (including Sundays)
CREATE OR REPLACE FUNCTION get_holiday_count(
    user_id_param UUID,
    start_date_param DATE,
    end_date_param DATE
)
RETURNS INTEGER AS $$
DECLARE
    holiday_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO holiday_count
    FROM public.unified_attendance
    WHERE user_id = user_id_param
    AND entry_date BETWEEN start_date_param AND end_date_param
    AND status = 'holiday';
    
    RETURN holiday_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_sunday_work_days_count(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_holiday_count(UUID, DATE, DATE) TO authenticated;

-- Show summary of changes
DO $$
DECLARE
    updated_count INTEGER;
    manual_updated_count INTEGER;
BEGIN
    -- Count how many records were updated
    SELECT COUNT(*)
    INTO updated_count
    FROM public.unified_attendance
    WHERE modification_reason LIKE '%Auto-marked as holiday (Sunday)%';
    
    SELECT COUNT(*)
    INTO manual_updated_count
    FROM public.unified_attendance
    WHERE manual_override_reason LIKE '%Updated to holiday (Sunday)%';
    
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Updated % existing Sunday entries to holiday status', updated_count;
    RAISE NOTICE 'Updated % manual Sunday entries to holiday status', manual_updated_count;
    RAISE NOTICE 'Trigger created to auto-mark future Sundays as holiday';
END $$;
