-- Find and Disable Auto-Marking System
-- This script finds the auto-marking function and disables it

-- Step 1: Find the function that's doing the auto-marking
SELECT 'Step 1: Find auto-marking function' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%Auto-marked as absent (work day, no attendance)%';

-- Step 2: Find triggers that might be calling this function
SELECT 'Step 2: Find triggers calling auto-marking' as step;
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'unified_attendance'
  AND event_object_schema = 'public'
  AND action_statement ILIKE '%auto%';

-- Step 3: Look for any functions that handle work day processing
SELECT 'Step 3: Find work day processing functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_definition ILIKE '%work day%' OR routine_definition ILIKE '%no attendance%');

-- Step 4: Check if there are any functions that process attendance automatically
SELECT 'Step 4: Find automatic attendance processing' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_definition ILIKE '%process%attendance%' OR routine_definition ILIKE '%auto%process%');

-- Step 5: Look for any functions that might be called by triggers
SELECT 'Step 5: Find trigger functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%TRIGGER%'
  AND routine_definition ILIKE '%unified_attendance%';

-- Step 6: Check if there are any functions that handle status updates
SELECT 'Step 6: Find status update functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%status%'
  AND routine_definition ILIKE '%absent%';

-- Step 7: Look for any functions that might be called automatically
SELECT 'Step 7: Find automatic functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_definition ILIKE '%automatic%' OR routine_definition ILIKE '%auto%')
  AND routine_definition ILIKE '%unified_attendance%';

-- Step 8: Check if there are any functions that handle work days
SELECT 'Step 8: Find work day functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%work%day%'
  AND routine_definition ILIKE '%unified_attendance%';

-- Step 9: Look for any functions that might be called by the system
SELECT 'Step 9: Find system functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_definition ILIKE '%system%' OR routine_definition ILIKE '%cron%')
  AND routine_definition ILIKE '%unified_attendance%';

-- Step 10: Check if there are any functions that handle attendance processing
SELECT 'Step 10: Find attendance processing functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%attendance%'
  AND routine_definition ILIKE '%process%';



