-- Harden RLS for unified_attendance: remove overly permissive "system" policies
-- Service role bypasses RLS and does not need explicit policies. Keeping these
-- policies is dangerous because USING (true) grants access to all authenticated users.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'unified_attendance' 
      AND policyname = 'System can view all attendance'
  ) THEN
    DROP POLICY "System can view all attendance" ON public.unified_attendance;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'unified_attendance' 
      AND policyname = 'System can insert attendance'
  ) THEN
    DROP POLICY "System can insert attendance" ON public.unified_attendance;
  END IF;
END $$;

-- Optional safety: ensure user/admin policies still exist (no-ops if they already do)
-- Note: We do not broaden access here; these mirror existing intent.

CREATE POLICY IF NOT EXISTS "Users can view their own attendance" ON public.unified_attendance
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own attendance" ON public.unified_attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own attendance" ON public.unified_attendance
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Admins can view all attendance" ON public.unified_attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'admin'
    )
  );

CREATE POLICY IF NOT EXISTS "Admins can insert attendance for any user" ON public.unified_attendance
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'admin'
    )
  );

CREATE POLICY IF NOT EXISTS "Admins can update attendance for any user" ON public.unified_attendance
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'admin'
    )
  );

