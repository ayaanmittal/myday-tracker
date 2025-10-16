-- Simple employee creation function that just creates a profile
-- Employee will need to sign up with their email to activate their account

CREATE OR REPLACE FUNCTION public.create_employee_profile_only(
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
  profile_id UUID;
  result JSON;
BEGIN
  -- Check if the current user is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create profiles';
  END IF;

  -- Check if email already exists in profiles
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = p_email) THEN
    RAISE EXCEPTION 'Profile with email % already exists', p_email;
  END IF;

  -- Generate a new UUID for the profile
  profile_id := gen_random_uuid();

  -- Create profile (without foreign key constraint to auth.users)
  INSERT INTO public.profiles (id, name, email, team, designation, is_active)
  VALUES (profile_id, p_name, p_email, p_team, p_designation, true);

  -- Create role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (profile_id, p_role::app_role);

  -- Return success result
  result := json_build_object(
    'success', true,
    'profile_id', profile_id,
    'message', 'Profile created successfully. Employee will need to sign up with their email to activate their account.'
  );

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_employee_profile_only(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
