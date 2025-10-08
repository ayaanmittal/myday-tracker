-- Create missing tables for the application
-- Run this in your Supabase SQL Editor

-- 1. Create tasks table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_to uuid NOT NULL,
  assigned_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])),
  due_date date,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id),
  CONSTRAINT tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id)
);

-- 2. Create extra_work_logs table
CREATE TABLE IF NOT EXISTS public.extra_work_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  day_entry_id uuid NOT NULL,
  user_id uuid NOT NULL,
  work_type text NOT NULL DEFAULT 'remote' CHECK (work_type = ANY (ARRAY['remote'::text, 'overtime'::text, 'weekend'::text, 'other'::text])),
  hours_worked decimal(4,2) NOT NULL CHECK (hours_worked > 0 AND hours_worked <= 24),
  description text,
  logged_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT extra_work_logs_pkey PRIMARY KEY (id),
  CONSTRAINT extra_work_logs_day_entry_id_fkey FOREIGN KEY (day_entry_id) REFERENCES public.day_entries(id) ON DELETE CASCADE,
  CONSTRAINT extra_work_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- 3. Add designation column to profiles table (if it doesn't exist)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS designation text;

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_extra_work_logs_day_entry_id ON public.extra_work_logs(day_entry_id);
CREATE INDEX IF NOT EXISTS idx_extra_work_logs_user_id ON public.extra_work_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_extra_work_logs_logged_at ON public.extra_work_logs(logged_at);

-- 5. Enable RLS on new tables
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_work_logs ENABLE ROW LEVEL SECURITY;

-- 6. Create basic RLS policies for tasks
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
CREATE POLICY "Users can view their own tasks" ON public.tasks
  FOR SELECT USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
CREATE POLICY "Users can update their own tasks" ON public.tasks
  FOR UPDATE USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "Admins and managers can view all tasks" ON public.tasks;
CREATE POLICY "Admins and managers can view all tasks" ON public.tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admins and managers can create tasks" ON public.tasks;
CREATE POLICY "Admins and managers can create tasks" ON public.tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admins and managers can update all tasks" ON public.tasks;
CREATE POLICY "Admins and managers can update all tasks" ON public.tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admins and managers can delete tasks" ON public.tasks;
CREATE POLICY "Admins and managers can delete tasks" ON public.tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

-- 7. Create basic RLS policies for extra_work_logs
DROP POLICY IF EXISTS "Users can view their own extra work logs" ON public.extra_work_logs;
CREATE POLICY "Users can view their own extra work logs" ON public.extra_work_logs
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own extra work logs" ON public.extra_work_logs;
CREATE POLICY "Users can create their own extra work logs" ON public.extra_work_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own extra work logs" ON public.extra_work_logs;
CREATE POLICY "Users can update their own extra work logs" ON public.extra_work_logs
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own extra work logs" ON public.extra_work_logs;
CREATE POLICY "Users can delete their own extra work logs" ON public.extra_work_logs
  FOR DELETE USING (user_id = auth.uid());

-- 8. Allow admins and managers to view all extra work logs
DROP POLICY IF EXISTS "Admins and managers can view all extra work logs" ON public.extra_work_logs;
CREATE POLICY "Admins and managers can view all extra work logs" ON public.extra_work_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );
