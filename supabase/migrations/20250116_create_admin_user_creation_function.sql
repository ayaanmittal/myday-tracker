-- Create a function to create users with admin privileges
-- This function will be called by admins to create new employee accounts

CREATE OR REPLACE FUNCTION public.create_employee_user(
  p_name TEXT,
  p_email TEXT,
  p_password TEXT,
  p_team TEXT DEFAULT NULL,
  p_designation TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'employee'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_user_id UUID;
  result JSON;
BEGIN
  -- Check if the current user is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'User with email % already exists', p_email;
  END IF;

  -- Create the user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    confirmed_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    '',
    now(),
    '',
    null,
    '',
    '',
    null,
    null,
    '{"provider": "email", "providers": ["email"]}',
    json_build_object('name', p_name, 'team', p_team, 'designation', p_designation),
    false,
    now(),
    now(),
    null,
    null,
    '',
    '',
    null,
    now(),
    '',
    0,
    null,
    '',
    null,
    false,
    null
  ) RETURNING id INTO new_user_id;

  -- Create profile
  INSERT INTO public.profiles (id, name, email, team, designation, is_active)
  VALUES (new_user_id, p_name, p_email, p_team, p_designation, true);

  -- Create role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, p_role::app_role);

  -- Return success result
  result := json_build_object(
    'success', true,
    'user_id', new_user_id,
    'message', 'User created successfully'
  );

  RETURN result;
END;
$$;

-- Grant execute permissions to authenticated users (admin check is inside the function)
GRANT EXECUTE ON FUNCTION public.create_employee_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Create a simpler function that just creates a profile without auth user
-- This can be used as a fallback when auth user creation is not available
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

  -- Create profile
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
