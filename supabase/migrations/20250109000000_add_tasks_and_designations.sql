-- Add designation column to profiles table
ALTER TABLE public.profiles ADD COLUMN designation text;

-- Create tasks table
CREATE TABLE public.tasks (
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

-- Create indexes for better performance
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);

-- Add RLS policies for tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view tasks assigned to them
CREATE POLICY "Users can view their own tasks" ON public.tasks
  FOR SELECT USING (assigned_to = auth.uid());

-- Policy: Users can update their own tasks
CREATE POLICY "Users can update their own tasks" ON public.tasks
  FOR UPDATE USING (assigned_to = auth.uid());

-- Policy: Admins and managers can view all tasks
CREATE POLICY "Admins and managers can view all tasks" ON public.tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

-- Policy: Admins and managers can create tasks
CREATE POLICY "Admins and managers can create tasks" ON public.tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

-- Policy: Admins and managers can update all tasks
CREATE POLICY "Admins and managers can update all tasks" ON public.tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

-- Policy: Admins and managers can delete tasks
CREATE POLICY "Admins and managers can delete tasks" ON public.tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );
