-- DEBUG LEAVES FETCH SCRIPT
-- This will help debug the leaves fetching issue

-- Step 1: Check if leaves table exists and has data
SELECT 'Checking leaves table:' as step;
SELECT COUNT(*) as total_leaves FROM public.leaves;

-- Step 2: Show sample leaves data
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
ORDER BY leave_date DESC 
LIMIT 5;

-- Step 3: Check if profiles table has matching data
SELECT 'Checking profiles for leave users:' as step;
SELECT 
  p.id,
  p.name,
  p.email,
  COUNT(l.id) as leave_count
FROM public.profiles p
LEFT JOIN public.leaves l ON l.user_id = p.user_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.email
HAVING COUNT(l.id) > 0
ORDER BY leave_count DESC;

-- Step 4: Check foreign key relationships
SELECT 'Checking foreign key relationships:' as step;
SELECT 
  l.id as leave_id,
  l.user_id,
  l.profile_id,
  p.id as profile_id_from_profiles,
  p.name,
  p.email
FROM public.leaves l
LEFT JOIN public.profiles p ON p.id = l.profile_id
LIMIT 5;

-- Step 5: Test the exact query that should work
SELECT 'Testing exact query:' as step;
SELECT 
  l.*,
  p.name,
  p.email
FROM public.leaves l
LEFT JOIN public.profiles p ON p.id = l.profile_id
ORDER BY l.leave_date DESC
LIMIT 5;
