-- Auto-mark all Sundays as Holiday unless they have actual check-in/check-out times
-- Run this in Supabase SQL Editor

-- Step 1: Update existing Sunday entries to 'holiday' status
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

-- Step 2: Update manual_status for Sunday entries that were manually marked as absent
UPDATE public.unified_attendance 
SET 
    manual_status = 'holiday',
    manual_override_reason = COALESCE(manual_override_reason, '') || '; Updated to holiday (Sunday)',
    updated_at = NOW()
WHERE 
    EXTRACT(DOW FROM entry_date) = 0  -- Sunday is 0
    AND manual_status = 'absent'  -- Only update manually marked absent entries
    AND NOT (check_in_at IS NOT NULL AND check_out_at IS NOT NULL);  -- Don't update if has both check-in and check-out

-- Step 3: Create function to auto-mark Sundays as holiday
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

-- Step 4: Create trigger to auto-mark Sundays as holiday on insert/update
DROP TRIGGER IF EXISTS trigger_auto_mark_sundays_as_holiday ON public.unified_attendance;
CREATE TRIGGER trigger_auto_mark_sundays_as_holiday
  BEFORE INSERT OR UPDATE ON public.unified_attendance
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_sundays_as_holiday();

-- Step 5: Show summary of changes
SELECT 
    'Migration completed successfully!' as message,
    COUNT(*) as updated_sunday_entries
FROM public.unified_attendance
WHERE modification_reason LIKE '%Auto-marked as holiday (Sunday)%';
