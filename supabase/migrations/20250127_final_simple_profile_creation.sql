-- Simple function to create employee profiles for existing auth users
-- Admin creates auth users manually in Supabase Dashboard, then creates profiles here

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
SET search_path = public, auth
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
    RAISE EXCEPTION 'Auth user with email % does not exist. Please create the auth user first in Supabase Dashboard (Authentication → Users → Add User).', p_email;
  END IF;

  -- Create or update profile
  INSERT INTO public.profiles (id, name, email, team, designation, is_active, user_id)
  VALUES (auth_user_id, p_name, p_email, p_team, p_designation, true, auth_user_id)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    team = EXCLUDED.team,
    designation = EXCLUDED.designation,
    is_active = true,
    user_id = EXCLUDED.user_id,
    updated_at = now();

  -- Create or update role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth_user_id, p_role::app_role)
  ON CONFLICT (user_id, role) DO UPDATE SET role = EXCLUDED.role;

  -- Return success result
  result := json_build_object(
    'success', true,
    'user_id', auth_user_id,
    'message', 'Employee profile created successfully and linked to existing auth user.'
  );

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_employee_profile_for_existing_auth_user(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_employee_profile_for_existing_auth_user(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

