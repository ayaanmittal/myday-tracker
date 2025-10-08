-- Drop the problematic policy
DROP POLICY IF EXISTS "Managers can view team profiles" ON public.profiles;

-- Create a security definer function to get user's team
CREATE OR REPLACE FUNCTION public.get_user_team(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team FROM public.profiles WHERE id = _user_id
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Managers can view team profiles"
  ON public.profiles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'manager') AND
    team = public.get_user_team(auth.uid())
  );