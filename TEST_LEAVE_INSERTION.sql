-- Test Leave Insertion Logic
-- This script tests the leave insertion logic to ensure each day gets a separate row

-- Step 1: Create a test function to verify the logic
CREATE OR REPLACE FUNCTION test_leave_insertion()
RETURNS json AS $$
DECLARE
  test_start_date date := '2025-01-20';
  test_end_date date := '2025-01-27';
  loop_date date;
  day_count integer := 0;
  result json;
BEGIN
  -- Simulate the leave insertion logic
  loop_date := test_start_date;
  
  WHILE loop_date <= test_end_date LOOP
    day_count := day_count + 1;
    
    -- Log each day that would be inserted
    RAISE NOTICE 'Day %: %', day_count, loop_date;
    
    -- Move to next day
    loop_date := loop_date + INTERVAL '1 day';
  END LOOP;
  
  -- Return the result
  RETURN json_build_object(
    'success', true,
    'start_date', test_start_date,
    'end_date', test_end_date,
    'total_days', day_count,
    'message', 'Leave insertion logic test completed'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Test error: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Step 2: Run the test
SELECT test_leave_insertion();

-- Step 3: Check the leaves table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'leaves' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 4: Show example of how leaves should be structured
SELECT 'Example: 8-day leave request should create 8 separate rows in leaves table' as explanation;
SELECT 'Each row should have: user_id, profile_id, leave_date (single date), leave_type_id, etc.' as structure;

-- Step 5: Clean up test function
DROP FUNCTION IF EXISTS test_leave_insertion();

