-- Drop existing attendance tables cleanly
-- No backups, just delete everything

-- Drop the existing tables and their dependencies
DROP TABLE IF EXISTS public.day_entries CASCADE;
DROP TABLE IF EXISTS public.attendance_logs CASCADE;

-- Drop old functions that are no longer needed
DROP FUNCTION IF EXISTS public.process_teamoffice_attendance_safe(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.process_individual_punch(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.process_teamoffice_attendance_individual(JSONB);
DROP FUNCTION IF EXISTS public.smart_cleanup_duplicates();
DROP FUNCTION IF EXISTS public.fix_incorrect_log_types();
DROP FUNCTION IF EXISTS public.get_proper_attendance_pairs(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.cleanup_attendance_logs_duplicates();
DROP FUNCTION IF EXISTS public.fix_attendance_data();
DROP FUNCTION IF EXISTS public.update_late_status_for_entries();
DROP FUNCTION IF EXISTS public.is_checkin_late(DATE, TIME);

-- Show final status
DO $$
DECLARE
  remaining_tables INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_tables 
  FROM information_schema.tables 
  WHERE table_name IN ('day_entries', 'attendance_logs')
  AND table_schema = 'public';
  
  RAISE NOTICE 'Cleanup Summary:';
  RAISE NOTICE '  Old tables remaining: %', remaining_tables;
  RAISE NOTICE '  Ready for unified_attendance table creation!';
END $$;

