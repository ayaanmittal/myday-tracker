-- Test script to verify the amount field migration works correctly

-- Test 1: Check if amount column exists
SELECT 'Testing amount column existence...' as test_step;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'employee_notes' 
AND column_name = 'amount';

-- Test 2: Check if index exists
SELECT 'Testing amount index existence...' as test_step;

SELECT indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'employee_notes' 
AND indexname = 'idx_employee_notes_amount';

-- Test 3: Check if function exists with correct signature
SELECT 'Testing function existence and signature...' as test_step;

SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_name = 'get_employee_notes_with_details'
AND routine_schema = 'public';

-- Test 4: Test function call (this will fail if function doesn't exist)
SELECT 'Testing function call...' as test_step;

-- This should work if the function exists with the correct signature
SELECT * FROM public.get_employee_notes_with_details(
  '00000000-0000-0000-0000-000000000000'::UUID,  -- Non-existent UUID for testing
  1,
  0
) LIMIT 0;

-- Test 5: Check table structure
SELECT 'Current employee_notes table structure:' as test_step;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'employee_notes' 
ORDER BY ordinal_position;

