-- Fix create_employee_with_password to handle triggers properly
-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.create_employee_with_password(
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
  v_auth_user_id UUID;
BEGIN
  -- Check if the current user is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  -- Check if email already exists
  SELECT id INTO v_auth_user_id FROM auth.users WHERE email = p_email;
  IF v_auth_user_id IS NOT NULL THEN
    -- User exists, create profile and role for existing auth user
    INSERT INTO public.profiles (id, name, email, team, designation, is_active, user_id)
    VALUES (v_auth_user_id, p_name, p_email, p_team, p_designation, true, v_auth_user_id)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      team = EXCLUDED.team,
      designation = EXCLUDED.designation,
      user_id = EXCLUDED.user_id,
      updated_at = now();

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_auth_user_id, p_role::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN json_build_object(
      'success', true,
      'user_id', v_auth_user_id,
      'message', 'Employee profile created for existing auth user.'
    );
  END IF;

  -- Generate a new UUID for the user
  new_user_id := gen_random_uuid();

  -- Create the user in auth.users
  -- Note: We can't use ALTER TABLE DISABLE TRIGGER on auth.users as it's a system table
  -- Instead, we'll insert with all required fields and let triggers fire naturally
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    email_change_confirm_status, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    new_user_id,
    'authenticated',
    'authenticated',
    p_email,
    public.crypt(p_password, public.gen_salt('bf')),
    now(),
    now(),
    '',
    now(),
    '',
    null,
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('name', p_name, 'team', p_team, 'designation', p_designation),
    false,
    now(),
    now(),
    0,
    false,
    false
  ) RETURNING id INTO v_auth_user_id;

  -- Verify the user was actually created
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create auth user - no ID returned';
  END IF;

  -- The trigger should have created the profile and role automatically
  -- But let's verify and create them if the trigger didn't fire
  -- Check if profile exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_auth_user_id) THEN
    INSERT INTO public.profiles (id, name, email, team, designation, is_active, user_id)
    VALUES (v_auth_user_id, p_name, p_email, p_team, p_designation, true, v_auth_user_id);
  END IF;

  -- Check if role exists
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_auth_user_id AND role = p_role::app_role) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_auth_user_id, p_role::app_role);
  END IF;

  -- Return success result
  result := json_build_object(
    'success', true,
    'user_id', v_auth_user_id,
    'message', 'Employee account created successfully. They can now log in with their email and password.'
  );

  RETURN result;
END;
$$;

-- Ensure the function has proper permissions
GRANT EXECUTE ON FUNCTION public.create_employee_with_password(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_employee_with_password(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

