-- Simple database setup script
-- Run this in your Supabase SQL Editor

-- 1. Create tasks table
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
  CONSTRAINT tasks_pkey PRIMARY KEY (id)
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
  CONSTRAINT extra_work_logs_pkey PRIMARY KEY (id)
);

-- 3. Add designation column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS designation text;

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_extra_work_logs_day_entry_id ON public.extra_work_logs(day_entry_id);
CREATE INDEX IF NOT EXISTS idx_extra_work_logs_user_id ON public.extra_work_logs(user_id);

-- 5. Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_work_logs ENABLE ROW LEVEL SECURITY;

-- 6. Basic RLS policies for tasks
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
CREATE POLICY "Users can view their own tasks" ON public.tasks
  FOR SELECT USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
CREATE POLICY "Users can update their own tasks" ON public.tasks
  FOR UPDATE USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "Admins can view all tasks" ON public.tasks;
CREATE POLICY "Admins can view all tasks" ON public.tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can create tasks" ON public.tasks;
CREATE POLICY "Admins can create tasks" ON public.tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update all tasks" ON public.tasks;
CREATE POLICY "Admins can update all tasks" ON public.tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete tasks" ON public.tasks;
CREATE POLICY "Admins can delete tasks" ON public.tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- 7. Basic RLS policies for extra_work_logs
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
