-- Fix Time Editing Issues
-- Run this in your Supabase SQL Editor to fix timing update problems

-- 1. Ensure all required columns exist in day_entries table
ALTER TABLE public.day_entries 
ADD COLUMN IF NOT EXISTS lunch_break_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS lunch_break_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS modification_reason TEXT;

-- 2. Create or update RLS policies for admin time editing
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own day entries" ON public.day_entries;
DROP POLICY IF EXISTS "Users can update their own day entries" ON public.day_entries;
DROP POLICY IF EXISTS "Admins can view all day entries" ON public.day_entries;
DROP POLICY IF EXISTS "Admins can update all day entries" ON public.day_entries;

-- Create comprehensive RLS policies
CREATE POLICY "Users can view their own day entries" ON public.day_entries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own day entries" ON public.day_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own day entries" ON public.day_entries
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can view all day entries" ON public.day_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all day entries" ON public.day_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 3. Create a function to safely update day entries with audit trail
CREATE OR REPLACE FUNCTION public.update_day_entry_times(
  entry_id UUID,
  new_check_in TIMESTAMPTZ DEFAULT NULL,
  new_check_out TIMESTAMPTZ DEFAULT NULL,
  new_lunch_start TIMESTAMPTZ DEFAULT NULL,
  new_lunch_end TIMESTAMPTZ DEFAULT NULL,
  modifier_id UUID DEFAULT NULL,
  reason TEXT DEFAULT 'Admin time correction'
)
RETURNS BOOLEAN AS $$
DECLARE
  total_minutes INTEGER := 0;
  lunch_minutes INTEGER := 0;
BEGIN
  -- Calculate total work time if both check-in and check-out are provided
  IF new_check_in IS NOT NULL AND new_check_out IS NOT NULL THEN
    total_minutes := EXTRACT(EPOCH FROM (new_check_out - new_check_in)) / 60;
    
    -- Subtract lunch break if both lunch times are provided
    IF new_lunch_start IS NOT NULL AND new_lunch_end IS NOT NULL THEN
      lunch_minutes := EXTRACT(EPOCH FROM (new_lunch_end - new_lunch_start)) / 60;
      total_minutes := GREATEST(0, total_minutes - lunch_minutes);
    END IF;
  END IF;

  -- Update the day entry
  UPDATE public.day_entries 
  SET 
    check_in_at = new_check_in,
    check_out_at = new_check_out,
    lunch_break_start = new_lunch_start,
    lunch_break_end = new_lunch_end,
    total_work_time_minutes = CASE WHEN total_minutes > 0 THEN total_minutes ELSE NULL END,
    last_modified_by = modifier_id,
    modification_reason = reason,
    updated_at = NOW()
  WHERE id = entry_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.update_day_entry_times TO authenticated;

-- 5. Create a function to get user role (for debugging)
-- Drop existing function first if it exists
DROP FUNCTION IF EXISTS public.get_user_role(UUID);
CREATE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role::TEXT 
    FROM public.user_roles 
    WHERE user_id = user_uuid 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create a function to check if user is admin
-- Drop existing function first if it exists
DROP FUNCTION IF EXISTS public.is_admin(UUID);
CREATE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = user_uuid AND role = 'admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_day_entries_user_id ON public.day_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_day_entries_entry_date ON public.day_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_day_entries_status ON public.day_entries(status);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- 8. Test the setup by creating sample data if none exists
DO $$
DECLARE
  user_count INTEGER;
  entry_count INTEGER;
  sample_user_id UUID;
  admin_user_id UUID;
BEGIN
  -- Check if there are any users
  SELECT COUNT(*) INTO user_count FROM auth.users;
  
  -- Check if there are any day entries
  SELECT COUNT(*) INTO entry_count FROM public.day_entries;
  
  -- If we have users but no entries, create some sample data
  IF user_count > 0 AND entry_count = 0 THEN
    -- Get the first user
    SELECT id INTO sample_user_id FROM auth.users LIMIT 1;
    
    -- Create sample entries for the last 7 days
    FOR i IN 0..6 LOOP
      -- Insert sample day entry
      INSERT INTO public.day_entries (
        user_id, 
        entry_date, 
        check_in_at, 
        check_out_at, 
        total_work_time_minutes, 
        status
      ) VALUES (
        sample_user_id,
        CURRENT_DATE - i,
        (CURRENT_DATE - i) + INTERVAL '9 hours',
        (CURRENT_DATE - i) + INTERVAL '17 hours',
        480, -- 8 hours in minutes
        'completed'
      );
    END LOOP;
    
    RAISE NOTICE 'Sample data created for testing';
  END IF;
  
  -- Ensure at least one admin user exists
  SELECT id INTO admin_user_id FROM auth.users LIMIT 1;
  IF admin_user_id IS NOT NULL THEN
    -- Make the first user an admin if they don't have a role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role assigned to user: %', admin_user_id;
  END IF;
END $$;

-- 9. Verify the fix
SELECT 
  'Time editing fix completed!' as message,
  (SELECT COUNT(*) FROM public.day_entries) as total_entries,
  (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin') as admin_count,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'day_entries' AND column_name IN ('lunch_break_start', 'lunch_break_end', 'last_modified_by', 'modification_reason')) as required_columns_count;
