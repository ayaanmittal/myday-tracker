-- TEST LEAVES TABLE STRUCTURE AND DATA
-- This will help verify the leaves table structure and data

-- Step 1: Check table structure
SELECT 'Table structure:' as step;
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'leaves' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Check if table has any data
SELECT 'Total leaves count:' as step;
SELECT COUNT(*) as total_leaves FROM public.leaves;

-- Step 3: Show sample data
SELECT 'Sample leaves data:' as step;
SELECT 
  id,
  user_id,
  profile_id,
  leave_date,
  leave_type_name,
  is_paid_leave,
  is_approved,
  created_at
FROM public.leaves 
ORDER BY created_at DESC 
LIMIT 10;

-- Step 4: Check for any RLS issues
SELECT 'Checking RLS policies:' as step;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'leaves';

-- Step 5: Test a simple query that should work
SELECT 'Testing simple query:' as step;
SELECT * FROM public.leaves LIMIT 5;



