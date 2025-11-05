-- Debug Leave Approval Error
-- This script helps identify why leave approval is failing

-- Step 1: Check if leaves table exists and has proper structure
SELECT 'Step 1: Check leaves table structure' as step;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'leaves' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Check RLS policies on leaves table
SELECT 'Step 2: Check RLS policies' as step;

SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'leaves' 
  AND schemaname = 'public';

-- Step 3: Check if current user has admin role
SELECT 'Step 3: Check current user roles' as step;

SELECT 
  ur.role,
  ur.user_id,
  u.email
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.user_id = auth.uid();

-- Step 4: Test if we can insert into leaves table
SELECT 'Step 4: Test leaves table access' as step;

-- Try to select from leaves table
SELECT COUNT(*) as leaves_count FROM public.leaves;

-- Step 5: Check if profiles table has the required data
SELECT 'Step 5: Check profiles table' as step;

SELECT 
  id,
  user_id,
  employee_category_id,
  created_at
FROM public.profiles 
WHERE user_id = auth.uid()
LIMIT 5;

-- Step 6: Check leave_types table
SELECT 'Step 6: Check leave_types table' as step;

SELECT 
  id,
  name,
  is_paid,
  is_active
FROM public.leave_types 
WHERE is_active = true
LIMIT 5;

-- Step 7: Check leave_requests table
SELECT 'Step 7: Check leave_requests table' as step;

SELECT 
  id,
  user_id,
  leave_type_id,
  start_date,
  end_date,
  status,
  created_at
FROM public.leave_requests 
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 5;



