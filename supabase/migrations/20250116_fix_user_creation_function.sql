-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a function that creates both auth user and profile with admin-set password
-- This allows immediate login without email confirmation

CREATE OR REPLACE FUNCTION public.create_employee_with_auth(
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

  -- Generate a new UUID for the user
  new_user_id := gen_random_uuid();

  -- Create the user in auth.users with admin-set password
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
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(), -- Email confirmed immediately
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
    '',
    0,
    null,
    '',
    null,
    false
  );

  -- Create profile linked to the auth user
  INSERT INTO public.profiles (id, name, email, team, designation, is_active, user_id)
  VALUES (new_user_id, p_name, p_email, p_team, p_designation, true, new_user_id);

  -- Create role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, p_role::app_role);

  -- Return success result
  result := json_build_object(
    'success', true,
    'user_id', new_user_id,
    'message', 'Employee account created successfully. They can now log in with their email and password.'
  );

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_employee_with_auth(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Alternative function that doesn't require pgcrypto (fallback)
CREATE OR REPLACE FUNCTION public.create_employee_simple(
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

  -- Generate a new UUID for the user
  new_user_id := gen_random_uuid();

  -- Create the user in auth.users with simple password (no hashing for now)
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
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    p_email,
    p_password, -- Store password directly (temporary solution)
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
    false
  );

  -- Create profile linked to the auth user
  INSERT INTO public.profiles (id, name, email, team, designation, is_active, user_id)
  VALUES (new_user_id, p_name, p_email, p_team, p_designation, true, new_user_id);

  -- Create role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, p_role::app_role);

  -- Return success result
  result := json_build_object(
    'success', true,
    'user_id', new_user_id,
    'message', 'Employee account created successfully. They can now log in with their email and password.'
  );

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_employee_simple(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
