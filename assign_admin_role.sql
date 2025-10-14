-- Assign Admin Role Script
-- Run this in your Supabase SQL Editor to give yourself admin permissions

-- First, let's see what users exist
SELECT 
  u.id,
  u.email,
  p.name,
  ur.role
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at DESC;

-- Replace 'your-email@example.com' with your actual email address
-- and run this query to assign yourself admin role
INSERT INTO public.user_roles (user_id, role)
SELECT 
  u.id,
  'admin'::app_role
FROM auth.users u
WHERE u.email = 'your-email@example.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Alternative: If you know your user ID, you can use this instead
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('your-user-id-here', 'admin'::app_role)
-- ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the role was assigned
SELECT 
  u.email,
  p.name,
  ur.role,
  ur.created_at
FROM auth.users u
JOIN public.profiles p ON u.id = p.id
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email = 'your-email@example.com';
