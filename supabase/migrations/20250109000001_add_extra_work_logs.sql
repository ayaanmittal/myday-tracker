-- Create extra_work_logs table for additional work hours
CREATE TABLE public.extra_work_logs (
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

-- Create indexes for better performance
CREATE INDEX idx_extra_work_logs_day_entry_id ON public.extra_work_logs(day_entry_id);
CREATE INDEX idx_extra_work_logs_user_id ON public.extra_work_logs(user_id);
CREATE INDEX idx_extra_work_logs_logged_at ON public.extra_work_logs(logged_at);

-- Add RLS policies for extra_work_logs
ALTER TABLE public.extra_work_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own extra work logs
CREATE POLICY "Users can view their own extra work logs" ON public.extra_work_logs
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can create their own extra work logs
CREATE POLICY "Users can create their own extra work logs" ON public.extra_work_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own extra work logs
CREATE POLICY "Users can update their own extra work logs" ON public.extra_work_logs
  FOR UPDATE USING (user_id = auth.uid());

-- Policy: Users can delete their own extra work logs
CREATE POLICY "Users can delete their own extra work logs" ON public.extra_work_logs
  FOR DELETE USING (user_id = auth.uid());

-- Policy: Admins and managers can view all extra work logs
CREATE POLICY "Admins and managers can view all extra work logs" ON public.extra_work_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

-- Policy: Admins and managers can update all extra work logs
CREATE POLICY "Admins and managers can update all extra work logs" ON public.extra_work_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

-- Policy: Admins and managers can delete all extra work logs
CREATE POLICY "Admins and managers can delete all extra work logs" ON public.extra_work_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );
