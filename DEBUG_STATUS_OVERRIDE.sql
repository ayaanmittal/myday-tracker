-- Debug Status Override Issue
-- This script investigates why the status is being overridden

-- Step 1: Check if there are any triggers on unified_attendance table
SELECT 'Step 1: Check triggers on unified_attendance' as step;
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'unified_attendance'
  AND event_object_schema = 'public';

-- Step 2: Check the current record that was created
SELECT 'Step 2: Check the problematic record' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  ua.device_info,
  ua.source,
  ua.created_at,
  ua.updated_at,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-01-27'::DATE
  AND ua.user_id = 'e048e5ea-9aed-4f1e-9058-218937fc136b';

-- Step 3: Try to manually update the status to see if it gets overridden
SELECT 'Step 3: Try manual status update' as step;
UPDATE public.unified_attendance 
SET status = 'holiday',
    manual_status = 'Office Holiday',
    modification_reason = 'Manual status update test',
    updated_at = NOW()
WHERE user_id = 'e048e5ea-9aed-4f1e-9058-218937fc136b'
  AND entry_date = '2025-01-27'::DATE;

-- Step 4: Check if the update worked
SELECT 'Step 4: Check if manual update worked' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  ua.updated_at,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-01-27'::DATE
  AND ua.user_id = 'e048e5ea-9aed-4f1e-9058-218937fc136b';

-- Step 5: Check if there are any functions that might be called automatically
SELECT 'Step 5: Check for auto-marking functions' as step;
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_name ILIKE '%auto%' OR routine_name ILIKE '%mark%' OR routine_name ILIKE '%attendance%')
ORDER BY routine_name;

-- Step 6: Check if there's a trigger that runs after insert/update
SELECT 'Step 6: Check for AFTER triggers' as step;
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_orientation,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'unified_attendance'
  AND event_object_schema = 'public'
  AND action_timing = 'AFTER';

-- Step 7: Look for any functions that might be setting status to 'absent'
SELECT 'Step 7: Search for functions that set status to absent' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%status%absent%';

-- Step 8: Check if there are any RLS policies that might be affecting this
SELECT 'Step 8: Check RLS policies' as step;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'unified_attendance';

-- Step 9: Try inserting a new record with explicit status
SELECT 'Step 9: Try explicit status insert' as step;
INSERT INTO public.unified_attendance (
  user_id, entry_date, device_info, source, status, manual_status, modification_reason
) VALUES (
  'e048e5ea-9aed-4f1e-9058-218937fc136b',
  '2025-01-31'::DATE,
  'Explicit Status Test',
  'manual',
  'holiday',  -- Explicitly set to holiday
  'Office Holiday',
  'Explicit status test'
);

-- Step 10: Check if the explicit insert worked
SELECT 'Step 10: Check explicit insert result' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-01-31'::DATE
  AND ua.user_id = 'e048e5ea-9aed-4f1e-9058-218937fc136b';
