-- Create a function to create profiles that reference existing auth users
-- Admin creates auth users manually, then this function creates the profile

CREATE OR REPLACE FUNCTION public.create_employee_profile_for_existing_auth_user(
  p_name TEXT,
  p_email TEXT,
  p_team TEXT DEFAULT NULL,
  p_designation TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'employee'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  auth_user_id UUID;
  result JSON;
BEGIN
  -- Check if the current user is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create profiles';
  END IF;

  -- Find the auth user by email
  SELECT id INTO auth_user_id 
  FROM auth.users 
  WHERE email = p_email;

  -- Check if auth user exists
  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user with email % does not exist. Please create the auth user first in Supabase Dashboard.', p_email;
  END IF;

  -- Check if profile already exists and is properly linked
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = p_email AND user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Profile with email % already exists and is linked to an auth user', p_email;
  END IF;

  -- Check if profile exists but is not linked to auth user
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = p_email AND user_id IS NULL) THEN
    -- Update existing profile to link it to the auth user
    UPDATE public.profiles 
    SET 
      id = auth_user_id,
      name = p_name,
      team = p_team,
      designation = p_designation,
      is_active = true,
      user_id = auth_user_id
    WHERE email = p_email;
  ELSE
    -- Create new profile linked to the existing auth user
    INSERT INTO public.profiles (id, name, email, team, designation, is_active, user_id)
    VALUES (auth_user_id, p_name, p_email, p_team, p_designation, true, auth_user_id);
  END IF;

  -- Create or update role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth_user_id, p_role::app_role)
  ON CONFLICT (user_id, role) DO UPDATE SET role = p_role::app_role;

  -- Return success result
  result := json_build_object(
    'success', true,
    'user_id', auth_user_id,
    'message', 'Profile created/updated successfully and linked to existing auth user.'
  );

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_employee_profile_for_existing_auth_user(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
