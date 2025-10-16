-- Fix profiles table foreign key constraint to allow profiles without auth.users reference
-- This allows creating employee profiles before they sign up

-- First, drop the existing foreign key constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Make the id column nullable temporarily to allow profiles without auth.users reference
-- We'll keep the primary key constraint but allow the foreign key to be null
ALTER TABLE public.profiles ALTER COLUMN id DROP NOT NULL;

-- Add a new column to track if the profile is linked to an auth user
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create a unique constraint on auth_user_id to ensure one-to-one relationship
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Update existing profiles to set auth_user_id = id where id exists
UPDATE public.profiles SET auth_user_id = id WHERE id IS NOT NULL;

-- Now we can make id nullable and use it as a primary key for profiles
-- but allow it to be different from auth_user_id
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Create a function to handle profile creation
CREATE OR REPLACE FUNCTION public.create_employee_profile(
  p_name TEXT,
  p_email TEXT,
  p_team TEXT DEFAULT NULL,
  p_designation TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'employee'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_id UUID;
BEGIN
  -- Generate a new UUID for the profile
  profile_id := gen_random_uuid();
  
  -- Insert the profile
  INSERT INTO public.profiles (id, name, email, team, designation, is_active)
  VALUES (profile_id, p_name, p_email, p_team, p_designation, true);
  
  -- Create the role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (profile_id, p_role::app_role);
  
  RETURN profile_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_employee_profile(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Create a function to link profile to auth user when they sign up
CREATE OR REPLACE FUNCTION public.link_profile_to_auth_user(
  p_profile_id UUID,
  p_auth_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the profile to link it to the auth user
  UPDATE public.profiles 
  SET auth_user_id = p_auth_user_id
  WHERE id = p_profile_id;
  
  -- Update the user_roles to use the auth user ID
  UPDATE public.user_roles 
  SET user_id = p_auth_user_id
  WHERE user_id = p_profile_id;
  
  RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.link_profile_to_auth_user(UUID, UUID) TO authenticated;
