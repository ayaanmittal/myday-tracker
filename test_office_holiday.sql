-- Test script to verify office holiday function works
-- Run this AFTER applying the fix_office_holiday_constraint.sql

-- Test 1: Check if the function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'mark_office_holiday_range';

-- Test 2: Check the constraint allows 'Office Holiday'
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'check_manual_status';

-- Test 3: Try to manually insert a record with 'Office Holiday' status
-- (This will fail if the constraint doesn't allow it)
DO $$
BEGIN
  -- Try to insert a test record
  INSERT INTO public.unified_attendance (
    user_id,
    entry_date,
    status,
    manual_status,
    device_info,
    source,
    modification_reason
  ) VALUES (
    (SELECT id FROM auth.users LIMIT 1),
    CURRENT_DATE,
    'Office Holiday',
    'Office Holiday',
    'Test',
    'manual',
    'Testing Office Holiday status'
  );
  
  RAISE NOTICE 'SUCCESS: Office Holiday status is allowed';
  
  -- Clean up test record
  DELETE FROM public.unified_attendance 
  WHERE modification_reason = 'Testing Office Holiday status';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: %', SQLERRM;
END $$;

