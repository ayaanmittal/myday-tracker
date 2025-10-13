-- Drop existing attendance tables before creating unified table
-- This ensures a clean slate for the unified_attendance table

-- First, let's create a backup of the existing data
CREATE TABLE IF NOT EXISTS public.attendance_backup_before_unified AS
SELECT 
  'day_entries' as source_table,
  de.id,
  de.user_id,
  de.entry_date,
  de.check_in_at,
  de.check_out_at,
  de.total_work_time_minutes,
  de.status,
  de.is_late,
  de.device_info,
  de.modification_reason,
  de.lunch_break_start,
  de.lunch_break_end,
  de.created_at,
  de.updated_at,
  NULL as employee_code,
  NULL as employee_name,
  NULL as device_id,
  'manual' as source
FROM day_entries de
WHERE de.user_id IS NOT NULL

UNION ALL

SELECT 
  'attendance_logs' as source_table,
  al.id,
  em.our_user_id as user_id,
  al.log_time::date as entry_date,
  CASE WHEN al.log_type = 'checkin' THEN al.log_time ELSE NULL END as check_in_at,
  CASE WHEN al.log_type = 'checkout' THEN al.log_time ELSE NULL END as check_out_at,
  NULL as total_work_time_minutes,
  'in_progress' as status,
  false as is_late,
  'TeamOffice API' as device_info,
  'Migrated from attendance_logs' as modification_reason,
  NULL as lunch_break_start,
  NULL as lunch_break_end,
  al.created_at,
  al.updated_at,
  al.employee_id::text as employee_code,
  al.employee_name,
  al.device_id,
  'teamoffice' as source
FROM attendance_logs al
LEFT JOIN employee_mappings em ON em.teamoffice_emp_code = al.employee_id::text
WHERE em.our_user_id IS NOT NULL;

-- Show backup summary
DO $$
DECLARE
  day_entries_count INTEGER;
  attendance_logs_count INTEGER;
  backup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO day_entries_count FROM day_entries;
  SELECT COUNT(*) INTO attendance_logs_count FROM attendance_logs;
  SELECT COUNT(*) INTO backup_count FROM attendance_backup_before_unified;
  
  RAISE NOTICE 'Backup Summary:';
  RAISE NOTICE '  day_entries records: %', day_entries_count;
  RAISE NOTICE '  attendance_logs records: %', attendance_logs_count;
  RAISE NOTICE '  backup records created: %', backup_count;
  RAISE NOTICE 'Backup completed successfully!';
END $$;

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
DROP FUNCTION IF EXISTS public.process_teamoffice_attendance_safe(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);
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
  RAISE NOTICE '  Backup table created: attendance_backup_before_unified';
  RAISE NOTICE '  Ready for unified_attendance table creation!';
END $$;


