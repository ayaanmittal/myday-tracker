-- Simple Database Fix - No ON CONFLICT clauses
-- Run this in your Supabase SQL Editor to fix "No work history available" issue

-- 1. Add missing columns to day_entries table
ALTER TABLE public.day_entries 
ADD COLUMN IF NOT EXISTS lunch_break_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS lunch_break_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS modification_reason TEXT;

-- 2. Add designation column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS designation TEXT;

-- 3. Create missing tables if they don't exist
CREATE TABLE IF NOT EXISTS public.extra_work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_entry_id UUID REFERENCES public.day_entries(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  work_type TEXT NOT NULL DEFAULT 'remote' CHECK (work_type IN ('remote', 'overtime', 'weekend', 'other')),
  hours_worked DECIMAL(4,2) NOT NULL CHECK (hours_worked > 0 AND hours_worked <= 24),
  description TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id) NOT NULL,
  assigned_by UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create leave system tables
CREATE TABLE IF NOT EXISTS public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  max_days_per_year INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  leave_type_id UUID REFERENCES public.leave_types(id) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested INTEGER NOT NULL,
  reason TEXT,
  work_from_home BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  leave_type_id UUID REFERENCES public.leave_types(id) NOT NULL,
  total_days INTEGER NOT NULL DEFAULT 0,
  used_days INTEGER NOT NULL DEFAULT 0,
  remaining_days INTEGER GENERATED ALWAYS AS (total_days - used_days) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, leave_type_id)
);

-- 5. Enable RLS on new tables
ALTER TABLE public.extra_work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- 6. Create essential RLS policies
DROP POLICY IF EXISTS "Users can view their own day entries" ON public.day_entries;
CREATE POLICY "Users can view their own day entries" ON public.day_entries
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all day entries" ON public.day_entries;
CREATE POLICY "Admins can view all day entries" ON public.day_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update all day entries" ON public.day_entries;
CREATE POLICY "Admins can update all day entries" ON public.day_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_day_entries_user_id ON public.day_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_day_entries_entry_date ON public.day_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_day_entries_status ON public.day_entries(status);
CREATE INDEX IF NOT EXISTS idx_extra_work_logs_day_entry_id ON public.extra_work_logs(day_entry_id);
CREATE INDEX IF NOT EXISTS idx_extra_work_logs_user_id ON public.extra_work_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON public.leave_requests(user_id);

-- 8. Insert default leave types (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.leave_types WHERE name = 'Sick Leave') THEN
    INSERT INTO public.leave_types (name, description, max_days_per_year) VALUES
      ('Sick Leave', 'Leave for illness', 12),
      ('Vacation Leave', 'Annual vacation leave', 21),
      ('Personal Leave', 'Personal time off', 5),
      ('Work From Home', 'Remote work days', 0),
      ('Emergency Leave', 'Emergency situations', 3),
      ('Maternity Leave', 'Maternity leave', 90),
      ('Paternity Leave', 'Paternity leave', 15);
  END IF;
END $$;

-- 9. Create sample data for testing (if no data exists)
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
      
      -- Insert sample day update
      INSERT INTO public.day_updates (
        day_entry_id,
        today_focus,
        progress,
        blockers
      ) VALUES (
        (SELECT id FROM public.day_entries WHERE user_id = sample_user_id AND entry_date = CURRENT_DATE - i),
        'Working on project tasks',
        'Completed major features',
        CASE WHEN i = 2 THEN 'Network issues' ELSE NULL END
      );
    END LOOP;
    
    RAISE NOTICE 'Sample data created for testing';
  END IF;
END $$;

-- 10. Verify the fix
SELECT 
  'Database fix completed!' as message,
  (SELECT COUNT(*) FROM public.day_entries) as total_entries,
  (SELECT COUNT(*) FROM public.profiles) as total_profiles,
  (SELECT COUNT(*) FROM public.user_roles) as total_roles;
