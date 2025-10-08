-- Complete Database Setup Script for MyDay Tracker
-- Run this in your Supabase SQL Editor to fix "No work history available" issue

-- 1. Create app_role enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'employee');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create profiles table with all required columns
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  team TEXT,
  designation TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- 4. Create day_entries table with all required columns
CREATE TABLE IF NOT EXISTS public.day_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  lunch_break_start TIMESTAMPTZ,
  lunch_break_end TIMESTAMPTZ,
  total_work_time_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'unlogged')),
  device_info TEXT,
  ip_address TEXT,
  last_modified_by UUID REFERENCES auth.users(id),
  modification_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, entry_date)
);

-- 5. Create day_updates table
CREATE TABLE IF NOT EXISTS public.day_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_entry_id UUID REFERENCES public.day_entries(id) ON DELETE CASCADE NOT NULL,
  today_focus TEXT NOT NULL,
  progress TEXT NOT NULL,
  blockers TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Create extra_work_logs table
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

-- 7. Create tasks table
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

-- 8. Create leave_types table
CREATE TABLE IF NOT EXISTS public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  max_days_per_year INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Create leave_requests table
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

-- 10. Create leave_balances table
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

-- 11. Create office_rules table
CREATE TABLE IF NOT EXISTS public.office_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Create rule_violations table
CREATE TABLE IF NOT EXISTS public.rule_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  rule_id UUID REFERENCES public.office_rules(id) NOT NULL,
  warning_level INTEGER NOT NULL CHECK (warning_level IN (1, 2, 3)),
  reason TEXT,
  flagged_by UUID REFERENCES auth.users(id) NOT NULL,
  flagged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID REFERENCES auth.users(id) NOT NULL,
  participant_2 UUID REFERENCES auth.users(id) NOT NULL,
  last_message_at TIMESTAMPTZ,
  last_message_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) NOT NULL,
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_day_entries_user_id ON public.day_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_day_entries_entry_date ON public.day_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_day_entries_status ON public.day_entries(status);
CREATE INDEX IF NOT EXISTS idx_day_updates_day_entry_id ON public.day_updates(day_entry_id);
CREATE INDEX IF NOT EXISTS idx_extra_work_logs_day_entry_id ON public.extra_work_logs(day_entry_id);
CREATE INDEX IF NOT EXISTS idx_extra_work_logs_user_id ON public.extra_work_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON public.leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_balances_user_id ON public.leave_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_rule_violations_user_id ON public.rule_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);

-- 16. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 17. Create RLS policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 18. Create RLS policies for day_entries
DROP POLICY IF EXISTS "Users can view their own day entries" ON public.day_entries;
CREATE POLICY "Users can view their own day entries" ON public.day_entries
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own day entries" ON public.day_entries;
CREATE POLICY "Users can insert their own day entries" ON public.day_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own day entries" ON public.day_entries;
CREATE POLICY "Users can update their own day entries" ON public.day_entries
  FOR UPDATE USING (user_id = auth.uid());

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

-- 19. Create RLS policies for day_updates
DROP POLICY IF EXISTS "Users can view their own day updates" ON public.day_updates;
CREATE POLICY "Users can view their own day updates" ON public.day_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.day_entries 
      WHERE id = day_entry_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own day updates" ON public.day_updates;
CREATE POLICY "Users can insert their own day updates" ON public.day_updates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.day_entries 
      WHERE id = day_entry_id AND user_id = auth.uid()
    )
  );

-- 20. Create RLS policies for extra_work_logs
DROP POLICY IF EXISTS "Users can view their own extra work logs" ON public.extra_work_logs;
CREATE POLICY "Users can view their own extra work logs" ON public.extra_work_logs
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own extra work logs" ON public.extra_work_logs;
CREATE POLICY "Users can insert their own extra work logs" ON public.extra_work_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 21. Create RLS policies for tasks
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
CREATE POLICY "Users can view their own tasks" ON public.tasks
  FOR SELECT USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "Admins can view all tasks" ON public.tasks;
CREATE POLICY "Admins can view all tasks" ON public.tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 22. Create RLS policies for leave_requests
DROP POLICY IF EXISTS "Users can view their own leave requests" ON public.leave_requests;
CREATE POLICY "Users can view their own leave requests" ON public.leave_requests
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all leave requests" ON public.leave_requests;
CREATE POLICY "Admins can view all leave requests" ON public.leave_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 23. Insert default leave types
INSERT INTO public.leave_types (name, description, max_days_per_year) 
SELECT * FROM (VALUES
  ('Sick Leave', 'Leave for illness', 12),
  ('Vacation Leave', 'Annual vacation leave', 21),
  ('Personal Leave', 'Personal time off', 5),
  ('Work From Home', 'Remote work days', 0),
  ('Emergency Leave', 'Emergency situations', 3),
  ('Maternity Leave', 'Maternity leave', 90),
  ('Paternity Leave', 'Paternity leave', 15)
) AS v(name, description, max_days_per_year)
WHERE NOT EXISTS (SELECT 1 FROM public.leave_types WHERE name = v.name);

-- 24. Insert sample office rules
INSERT INTO public.office_rules (title, description) 
SELECT * FROM (VALUES
  ('Punctuality', 'Employees must arrive on time for work'),
  ('Dress Code', 'Professional attire is required in the office'),
  ('Meeting Etiquette', 'Be respectful and prepared for meetings'),
  ('Data Security', 'Protect company data and information'),
  ('Workplace Conduct', 'Maintain professional behavior at all times')
) AS v(title, description)
WHERE NOT EXISTS (SELECT 1 FROM public.office_rules WHERE title = v.title);

-- 25. Create a function to automatically create user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.email);
  
  -- Assign employee role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 26. Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 27. Create a function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
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

-- 28. Create a function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
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

-- 29. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- 30. Create sample data for testing (optional - remove in production)
-- This will create some sample day entries for testing
DO $$
DECLARE
  sample_user_id UUID;
  sample_date DATE;
  i INTEGER;
BEGIN
  -- Get the first user from auth.users (if any exists)
  SELECT id INTO sample_user_id FROM auth.users LIMIT 1;
  
  IF sample_user_id IS NOT NULL THEN
    -- Create sample day entries for the last 7 days
    FOR i IN 0..6 LOOP
      sample_date := CURRENT_DATE - i;
      
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
        sample_date,
        sample_date + INTERVAL '9 hours',
        sample_date + INTERVAL '17 hours',
        480, -- 8 hours in minutes
        'completed'
      ) WHERE NOT EXISTS (
        SELECT 1 FROM public.day_entries de2 
        WHERE de2.user_id = sample_user_id AND de2.entry_date = sample_date
      );
      
      -- Insert sample day update
      INSERT INTO public.day_updates (
        day_entry_id,
        today_focus,
        progress,
        blockers
      ) VALUES (
        (SELECT id FROM public.day_entries WHERE user_id = sample_user_id AND entry_date = sample_date),
        'Working on project tasks',
        'Completed 3 major features',
        CASE WHEN i = 2 THEN 'Network issues' ELSE NULL END
      ) WHERE NOT EXISTS (
        SELECT 1 FROM public.day_updates du2 
        WHERE du2.day_entry_id = (SELECT id FROM public.day_entries WHERE user_id = sample_user_id AND entry_date = sample_date)
      );
    END LOOP;
  END IF;
END $$;

-- Success message
SELECT 'Database setup completed successfully! All tables, policies, and sample data have been created.' as message;
