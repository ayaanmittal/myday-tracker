-- Fix Admin Role Assignment
-- Run this in Supabase SQL Editor to fix the "Access Denied" issue

-- Step 1: Check what users exist
SELECT 
  u.id,
  u.email,
  u.created_at,
  p.name as profile_name,
  p.is_active,
  ur.role
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at DESC;

-- Step 2: Check if user_roles table exists and has data
SELECT COUNT(*) as total_roles FROM public.user_roles;

-- Step 3: Assign admin role to the most recent user (usually the one you just created)
-- Replace 'your-email@example.com' with your actual email
INSERT INTO public.user_roles (user_id, role)
SELECT 
  u.id,
  'admin'::app_role
FROM auth.users u
WHERE u.email = 'your-email@example.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 4: Alternative - Assign admin role to the most recent user
-- (Use this if you don't know your email or want to assign to the latest user)
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

-- Step 5: Verify the role was assigned
SELECT 
  u.email,
  p.name,
  ur.role,
  ur.created_at as role_assigned_at
FROM auth.users u
JOIN public.profiles p ON u.id = p.id
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'admin';

-- Step 6: If you want to assign admin role to ALL users (for testing)
-- WARNING: Only use this in development!
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT 
--   u.id,
--   'admin'::app_role
-- FROM auth.users u
-- ON CONFLICT (user_id, role) DO NOTHING;
