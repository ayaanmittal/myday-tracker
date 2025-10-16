-- Simple employee creation without password hashing
-- This approach stores the password directly and lets Supabase handle auth

CREATE OR REPLACE FUNCTION public.create_employee_simple_auth(
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

  -- Create the user in auth.users with minimal fields (no password hashing)
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data
  ) VALUES (
    new_user_id,
    p_email,
    p_password, -- Store password directly (no hashing)
    now(),
    '{"provider": "email", "providers": ["email"]}',
    json_build_object('name', p_name, 'team', p_team, 'designation', p_designation)
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
GRANT EXECUTE ON FUNCTION public.create_employee_simple_auth(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
