-- Fix unlogged status entries in unified_attendance

-- First, let's see what unlogged entries we have
DO $$
DECLARE
  unlogged_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unlogged_count FROM unified_attendance WHERE status = 'unlogged';
  SELECT COUNT(*) INTO total_count FROM unified_attendance;
  
  RAISE NOTICE 'Current unified_attendance status:';
  RAISE NOTICE '  Total records: %', total_count;
  RAISE NOTICE '  Unlogged records: %', unlogged_count;
END $$;

-- Option 1: Convert unlogged entries to absent if they have no check-in/out times
UPDATE unified_attendance 
SET status = 'absent'
WHERE status = 'unlogged' 
  AND check_in_at IS NULL 
  AND check_out_at IS NULL;

-- Option 2: Convert unlogged entries to in_progress if they have check-in but no check-out
UPDATE unified_attendance 
SET status = 'in_progress'
WHERE status = 'unlogged' 
  AND check_in_at IS NOT NULL 
  AND check_out_at IS NULL;

-- Option 3: Convert unlogged entries to completed if they have both check-in and check-out
UPDATE unified_attendance 
SET status = 'completed'
WHERE status = 'unlogged' 
  AND check_in_at IS NOT NULL 
  AND check_out_at IS NOT NULL;

-- Show final status
DO $$
DECLARE
  status_counts RECORD;
BEGIN
  RAISE NOTICE 'Final unified_attendance status distribution:';
  
  FOR status_counts IN 
    SELECT status, COUNT(*) as count 
    FROM unified_attendance 
    GROUP BY status 
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  %: %', status_counts.status, status_counts.count;
  END LOOP;
END $$;

