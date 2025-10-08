-- Database Troubleshooting Script
-- Run this to diagnose "No work history available" issue

-- 1. Check if required tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IS NOT NULL THEN 'EXISTS' 
    ELSE 'MISSING' 
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'profiles', 
    'user_roles', 
    'day_entries', 
    'day_updates', 
    'extra_work_logs',
    'tasks',
    'leave_types',
    'leave_requests',
    'leave_balances'
  )
ORDER BY table_name;

-- 2. Check if day_entries table has required columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'day_entries'
ORDER BY ordinal_position;

-- 3. Check if there are any day entries in the database
SELECT 
  COUNT(*) as total_entries,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(entry_date) as earliest_date,
  MAX(entry_date) as latest_date
FROM public.day_entries;

-- 4. Check if there are any users with profiles
SELECT 
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_profiles
FROM public.profiles;

-- 5. Check user roles
SELECT 
  role,
  COUNT(*) as count
FROM public.user_roles
GROUP BY role;

-- 6. Check if RLS is enabled on day_entries
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'day_entries';

-- 7. Check RLS policies on day_entries
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'day_entries';

-- 8. Sample query to test if data can be fetched
SELECT 
  de.id,
  de.entry_date,
  de.check_in_at,
  de.check_out_at,
  de.status,
  p.name as user_name
FROM public.day_entries de
LEFT JOIN public.profiles p ON de.user_id = p.id
LIMIT 5;

-- 9. Check for any missing foreign key constraints
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('day_entries', 'day_updates', 'extra_work_logs')
ORDER BY tc.table_name, tc.constraint_name;

-- 10. Check if there are any errors in the application logs
-- (This would need to be checked in the Supabase dashboard)

SELECT 'Troubleshooting complete. Check the results above to identify the issue.' as message;
