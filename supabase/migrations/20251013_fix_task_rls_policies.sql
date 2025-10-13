-- Fix RLS policies for task-related tables
-- This migration adds proper RLS policies to allow users to interact with task data

-- Enable RLS on task-related tables if not already enabled
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_timers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "task_comments_policy" ON public.task_comments;
DROP POLICY IF EXISTS "task_attachments_policy" ON public.task_attachments;
DROP POLICY IF EXISTS "task_assignees_policy" ON public.task_assignees;
DROP POLICY IF EXISTS "task_followers_policy" ON public.task_followers;
DROP POLICY IF EXISTS "task_reminders_policy" ON public.task_reminders;
DROP POLICY IF EXISTS "task_checklist_policy" ON public.task_checklist;
DROP POLICY IF EXISTS "task_timers_policy" ON public.task_timers;

-- Task Comments Policies
CREATE POLICY "task_comments_policy" ON public.task_comments
  FOR ALL USING (
    -- Users can see comments for tasks they're assigned to or following
    task_id IN (
      SELECT id FROM public.tasks WHERE assigned_to = auth.uid()
      UNION
      SELECT ta.task_id FROM public.task_assignees ta WHERE ta.user_id = auth.uid()
      UNION
      SELECT tf.task_id FROM public.task_followers tf WHERE tf.user_id = auth.uid()
    )
    OR
    -- Admins and managers can see all comments
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

-- Task Attachments Policies
CREATE POLICY "task_attachments_policy" ON public.task_attachments
  FOR ALL USING (
    -- Users can see attachments for tasks they're assigned to or following
    task_id IN (
      SELECT id FROM public.tasks WHERE assigned_to = auth.uid()
      UNION
      SELECT ta.task_id FROM public.task_assignees ta WHERE ta.user_id = auth.uid()
      UNION
      SELECT tf.task_id FROM public.task_followers tf WHERE tf.user_id = auth.uid()
    )
    OR
    -- Admins and managers can see all attachments
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

-- Task Assignees Policies
CREATE POLICY "task_assignees_policy" ON public.task_assignees
  FOR ALL USING (
    -- Users can see assignees for tasks they're involved with
    task_id IN (
      SELECT id FROM public.tasks WHERE assigned_to = auth.uid()
      UNION
      SELECT ta.task_id FROM public.task_assignees ta WHERE ta.user_id = auth.uid()
      UNION
      SELECT tf.task_id FROM public.task_followers tf WHERE tf.user_id = auth.uid()
    )
    OR
    -- Admins and managers can see all assignees
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

-- Task Followers Policies
CREATE POLICY "task_followers_policy" ON public.task_followers
  FOR ALL USING (
    -- Users can see followers for tasks they're involved with
    task_id IN (
      SELECT id FROM public.tasks WHERE assigned_to = auth.uid()
      UNION
      SELECT ta.task_id FROM public.task_assignees ta WHERE ta.user_id = auth.uid()
      UNION
      SELECT tf.task_id FROM public.task_followers tf WHERE tf.user_id = auth.uid()
    )
    OR
    -- Admins and managers can see all followers
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

-- Task Reminders Policies
CREATE POLICY "task_reminders_policy" ON public.task_reminders
  FOR ALL USING (
    -- Users can see reminders for tasks they're involved with
    task_id IN (
      SELECT id FROM public.tasks WHERE assigned_to = auth.uid()
      UNION
      SELECT ta.task_id FROM public.task_assignees ta WHERE ta.user_id = auth.uid()
      UNION
      SELECT tf.task_id FROM public.task_followers tf WHERE tf.user_id = auth.uid()
    )
    OR
    -- Admins and managers can see all reminders
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

-- Task Checklist Policies
CREATE POLICY "task_checklist_policy" ON public.task_checklist
  FOR ALL USING (
    -- Users can see checklist items for tasks they're involved with
    task_id IN (
      SELECT id FROM public.tasks WHERE assigned_to = auth.uid()
      UNION
      SELECT ta.task_id FROM public.task_assignees ta WHERE ta.user_id = auth.uid()
      UNION
      SELECT tf.task_id FROM public.task_followers tf WHERE tf.user_id = auth.uid()
    )
    OR
    -- Admins and managers can see all checklist items
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

-- Task Timers Policies
CREATE POLICY "task_timers_policy" ON public.task_timers
  FOR ALL USING (
    -- Users can see their own timers
    user_id = auth.uid()
    OR
    -- Users can see timers for tasks they're involved with
    task_id IN (
      SELECT id FROM public.tasks WHERE assigned_to = auth.uid()
      UNION
      SELECT ta.task_id FROM public.task_assignees ta WHERE ta.user_id = auth.uid()
      UNION
      SELECT tf.task_id FROM public.task_followers tf WHERE tf.user_id = auth.uid()
    )
    OR
    -- Admins and managers can see all timers
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

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
