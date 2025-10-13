-- Simple RLS policies for task tables (more permissive for testing)
-- This allows all authenticated users to access task data

-- Enable RLS on task-related tables
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_timers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_comments;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_attachments;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_assignees;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_followers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_reminders;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_checklist;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_timers;

-- Create simple policies that allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON public.task_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON public.task_attachments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON public.task_assignees
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON public.task_followers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON public.task_reminders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON public.task_checklist
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON public.task_timers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON public.task_comments TO authenticated;
GRANT ALL ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_assignees TO authenticated;
GRANT ALL ON public.task_followers TO authenticated;
GRANT ALL ON public.task_reminders TO authenticated;
GRANT ALL ON public.task_checklist TO authenticated;
GRANT ALL ON public.task_timers TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
