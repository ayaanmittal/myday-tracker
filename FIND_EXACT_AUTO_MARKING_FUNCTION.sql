-- Find Exact Auto-Marking Function
-- This script finds the exact function that's adding the auto-marking message

-- Step 1: Search for the exact auto-marking message
SELECT 'Step 1: Find exact auto-marking message' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%Auto-marked as absent (work day, no attendance)%';

-- Step 2: Search for any function that contains "Auto-marked as absent"
SELECT 'Step 2: Find any auto-marking function' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%Auto-marked as absent%';

-- Step 3: Search for functions that contain "work day, no attendance"
SELECT 'Step 3: Find work day no attendance function' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%work day, no attendance%';

-- Step 4: Search for any function that might be processing attendance automatically
SELECT 'Step 4: Find automatic attendance processing' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_definition ILIKE '%auto%mark%' OR routine_definition ILIKE '%automatic%mark%');

-- Step 5: Look for any functions that might be called by triggers
SELECT 'Step 5: Find trigger functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%TRIGGER%'
  AND routine_definition ILIKE '%unified_attendance%';

-- Step 6: Check if there are any functions that handle work days specifically
SELECT 'Step 6: Find work day functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%work%day%'
  AND routine_definition ILIKE '%unified_attendance%';

-- Step 7: Look for any functions that might be called by the system automatically
SELECT 'Step 7: Find system functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_definition ILIKE '%system%' OR routine_definition ILIKE '%cron%' OR routine_definition ILIKE '%schedule%')
  AND routine_definition ILIKE '%unified_attendance%';

-- Step 8: Check if there are any functions that handle attendance processing
SELECT 'Step 8: Find attendance processing functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%attendance%'
  AND routine_definition ILIKE '%process%';

-- Step 9: Look for any functions that might be called by the application
SELECT 'Step 9: Find application functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_definition ILIKE '%application%' OR routine_definition ILIKE '%app%')
  AND routine_definition ILIKE '%unified_attendance%';

-- Step 10: Check if there are any functions that handle status updates
SELECT 'Step 10: Find status update functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%status%'
  AND routine_definition ILIKE '%absent%';



