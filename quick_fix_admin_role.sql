-- Quick Fix: Assign Admin Role
-- Run this in Supabase SQL Editor

-- Step 1: Check what users exist and their roles
SELECT 
  u.id,
  u.email,
  u.created_at,
  p.name as profile_name,
  ur.role
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at DESC;

-- Step 2: Assign admin role to the most recent user (usually you)
INSERT INTO public.user_roles (user_id, role)
SELECT 
  u.id,
  'admin'::app_role
FROM auth.users u
WHERE u.id = (
  SELECT id FROM auth.users 
  ORDER BY created_at DESC 
  LIMIT 1
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 3: Alternative - Assign admin role by email (replace with your email)
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT 
--   u.id,
--   'admin'::app_role
-- FROM auth.users u
-- WHERE u.email = 'your-email@example.com'
-- ON CONFLICT (user_id, role) DO NOTHING;

-- Step 4: Verify the role was assigned
SELECT 
  u.email,
  p.name,
  ur.role,
  ur.created_at as role_assigned_at
FROM auth.users u
JOIN public.profiles p ON u.id = p.id
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'admin';
