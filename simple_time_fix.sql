-- Simple Time Editing Fix - No Function Conflicts
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

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_day_entries_user_id ON public.day_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_day_entries_entry_date ON public.day_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_day_entries_status ON public.day_entries(status);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- 4. Ensure at least one admin user exists
DO $$
DECLARE
  admin_count INTEGER;
  first_user_id UUID;
BEGIN
  -- Check if there are any admin users
  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  
  -- If no admins exist, make the first user an admin
  IF admin_count = 0 THEN
    SELECT id INTO first_user_id FROM auth.users LIMIT 1;
    IF first_user_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (first_user_id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
      
      RAISE NOTICE 'Admin role assigned to user: %', first_user_id;
    END IF;
  END IF;
END $$;

-- 5. Create sample data for testing if none exists
DO $$
DECLARE
  user_count INTEGER;
  entry_count INTEGER;
  sample_user_id UUID;
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
END $$;

-- 6. Verify the fix
SELECT 
  'Time editing fix completed!' as message,
  (SELECT COUNT(*) FROM public.day_entries) as total_entries,
  (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin') as admin_count,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'day_entries' AND column_name IN ('lunch_break_start', 'lunch_break_end', 'last_modified_by', 'modification_reason')) as required_columns_count;
