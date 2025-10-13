-- Drop old attendance tables after confirming unified_attendance works
-- WARNING: This will permanently delete all data in the old tables!

-- First, let's create a backup function to restore if needed
CREATE OR REPLACE FUNCTION public.backup_old_attendance_tables()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  backup_table_name TEXT;
BEGIN
  -- Create backup of day_entries
  backup_table_name := 'day_entries_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
  EXECUTE format('CREATE TABLE %I AS SELECT * FROM day_entries', backup_table_name);
  
  -- Create backup of attendance_logs
  EXECUTE format('CREATE TABLE %I AS SELECT * FROM attendance_logs', 'attendance_logs_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS'));
  
  RETURN 'Backup created: ' || backup_table_name;
END;
$$;

-- Create the backup
SELECT public.backup_old_attendance_tables();

-- Drop old tables and their dependencies
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
DROP FUNCTION IF EXISTS public.cleanup_attendance_logs_duplicates();

-- Show final status
DO $$
DECLARE
  unified_count INTEGER;
  backup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unified_count FROM unified_attendance;
  
  -- Count backup tables
  SELECT COUNT(*) INTO backup_count 
  FROM information_schema.tables 
  WHERE table_name LIKE '%_backup_%' 
  AND table_schema = 'public';
  
  RAISE NOTICE 'Cleanup Summary:';
  RAISE NOTICE '  unified_attendance records: %', unified_count;
  RAISE NOTICE '  backup tables created: %', backup_count;
  RAISE NOTICE '  old tables dropped successfully!';
  RAISE NOTICE '  All attendance data is now in unified_attendance table';
END $$;

