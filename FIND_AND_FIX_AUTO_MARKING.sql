-- Find and Fix Auto-Marking System
-- This script finds the auto-marking function and fixes it to respect office holidays

-- Step 1: Find the function that's doing the auto-marking
SELECT 'Step 1: Find auto-marking function' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%Auto-marked as absent%';

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

-- Step 3: Look for functions that handle work day marking
SELECT 'Step 3: Find work day marking functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_definition ILIKE '%work day%' OR routine_definition ILIKE '%no attendance%');

-- Step 4: Check if there's a function that processes attendance
SELECT 'Step 4: Find attendance processing functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_definition ILIKE '%process%attendance%' OR routine_definition ILIKE '%mark%absent%');

-- Step 5: Look for the specific function that's adding the auto-marking message
SELECT 'Step 5: Find function with auto-marking message' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%Auto-marked as absent (work day, no attendance)%';

-- Step 6: Check if there are any functions that run on INSERT/UPDATE
SELECT 'Step 6: Check for INSERT/UPDATE functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_definition ILIKE '%INSERT%' OR routine_definition ILIKE '%UPDATE%')
  AND routine_definition ILIKE '%unified_attendance%';

-- Step 7: Look for any functions that might be called by triggers
SELECT 'Step 7: Find trigger functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%TRIGGER%'
  AND routine_definition ILIKE '%unified_attendance%';

-- Step 8: Check if there's a function that handles the status field specifically
SELECT 'Step 8: Find status handling functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%status%'
  AND routine_definition ILIKE '%absent%';

-- Step 9: Look for any functions that might be called automatically
SELECT 'Step 9: Find automatic functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_definition ILIKE '%automatic%' OR routine_definition ILIKE '%auto%')
  AND routine_definition ILIKE '%unified_attendance%';

-- Step 10: Check if there are any functions that handle work days
SELECT 'Step 10: Find work day functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%work%day%'
  AND routine_definition ILIKE '%unified_attendance%';

