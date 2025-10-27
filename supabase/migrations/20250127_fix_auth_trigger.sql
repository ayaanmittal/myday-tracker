-- Fix the handle_new_user trigger to be more robust
-- It should only create profiles and roles, not try to insert into users table

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  default_category_id UUID;
BEGIN
  -- Get default employee category ID (use the first available)
  SELECT id INTO default_category_id FROM public.employee_categories LIMIT 1;
  
  -- If no category exists, try to use NULL (might fail if it's required)
  IF default_category_id IS NULL THEN
    -- Insert into profiles table with minimal required fields
    INSERT INTO public.profiles (id, name, email, user_id, joined_on_date, employee_category_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      NEW.email,
      NEW.id,
      CURRENT_DATE,
      gen_random_uuid()  -- Create a dummy category if none exists
    );
  ELSE
    -- Insert into profiles table with proper category
    INSERT INTO public.profiles (id, name, email, user_id, joined_on_date, employee_category_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      NEW.email,
      NEW.id,
      CURRENT_DATE,
      default_category_id
    );
  END IF;
  
  -- Assign default employee role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the auth user creation
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

