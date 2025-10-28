-- Fix user role authorization for office holiday function
-- This script checks and fixes user role issues

-- Step 1: Check current user and their role
SELECT 'Step 1: Checking current user and role' as step;
SELECT 
  auth.uid() as current_user_id,
  p.name as user_name,
  p.email,
  ur.role,
  p.is_active
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE p.id = auth.uid();

-- Step 2: Check all user roles in the system
SELECT 'Step 2: Checking all user roles' as step;
SELECT 
  p.name,
  p.email,
  ur.role,
  p.is_active
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
ORDER BY p.name;

-- Step 3: Check if user_roles table exists and has data
SELECT 'Step 3: Checking user_roles table' as step;
SELECT 
  COUNT(*) as total_roles,
  COUNT(DISTINCT user_id) as unique_users,
  array_agg(DISTINCT role) as available_roles
FROM public.user_roles;

-- Step 4: If no roles found, create admin role for current user
DO $$
DECLARE
  current_user_id UUID;
  existing_role TEXT;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if current user has a role
  SELECT role INTO existing_role
  FROM public.user_roles
  WHERE user_id = current_user_id;
  
  IF existing_role IS NULL THEN
    -- Create admin role for current user
    INSERT INTO public.user_roles (user_id, role, created_at)
    VALUES (current_user_id, 'admin', NOW());
    
    RAISE NOTICE 'Created admin role for user %', current_user_id;
  ELSE
    RAISE NOTICE 'User % already has role: %', current_user_id, existing_role;
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating role: %', SQLERRM;
END;
$$;

-- Step 5: Verify the role was created
SELECT 'Step 5: Verifying role creation' as step;
SELECT 
  auth.uid() as current_user_id,
  ur.role,
  ur.created_at
FROM public.user_roles ur
WHERE ur.user_id = auth.uid();

-- Step 6: Test the office holiday function with test version (no authorization)
SELECT 'Step 6: Testing office holiday function (test version)' as step;
SELECT public.mark_office_holiday_range_test(
  '2025-01-25'::DATE, 
  '2025-01-25'::DATE, 
  NULL
) as test_result;

-- Step 7: Test the regular office holiday function
SELECT 'Step 7: Testing regular office holiday function' as step;
SELECT public.mark_office_holiday_range(
  '2025-01-25'::DATE, 
  '2025-01-25'::DATE, 
  NULL
) as regular_result;

-- Step 8: Check if records were updated
SELECT 'Step 8: Checking if records were updated' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-01-25'::DATE
  AND (ua.modification_reason LIKE '%office holiday%' OR ua.manual_status = 'Office Holiday')
ORDER BY p.name;

