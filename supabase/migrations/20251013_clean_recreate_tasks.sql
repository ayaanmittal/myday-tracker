-- Clean recreation of the entire task system
-- This migration drops all existing task tables and recreates them properly

-- 1. Drop all existing task-related tables and views (in reverse dependency order)
DROP VIEW IF EXISTS public.v_task_time_by_user CASCADE;
DROP TABLE IF EXISTS public.task_timers CASCADE;
DROP TABLE IF EXISTS public.task_checklist CASCADE;
DROP TABLE IF EXISTS public.task_reminders CASCADE;
DROP TABLE IF EXISTS public.task_followers CASCADE;
DROP TABLE IF EXISTS public.task_assignees CASCADE;
DROP TABLE IF EXISTS public.task_attachments CASCADE;
DROP TABLE IF EXISTS public.task_comments CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;

-- 2. Create the main tasks table
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_updated timestamptz DEFAULT now()
);

-- 3. Create task_comments table
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  assignee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create task_attachments table
CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  assignee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Create task_assignees table (for multiple assignees)
CREATE TABLE public.task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

-- 6. Create task_followers table
CREATE TABLE public.task_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

-- 7. Create task_reminders table
CREATE TABLE public.task_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  remind_at timestamptz NOT NULL,
  note text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Create task_checklist table
CREATE TABLE public.task_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_done boolean DEFAULT false NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sort_order integer NOT NULL DEFAULT 0
);

-- 9. Create task_timers table
CREATE TABLE public.task_timers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  duration_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add unique constraint to prevent multiple concurrent running timers
CREATE UNIQUE INDEX unique_running_timer_per_user_task 
ON public.task_timers (task_id, user_id) 
WHERE end_time IS NULL;

-- 10. Create indexes for better performance
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_assigned_by ON public.tasks(assigned_by);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_priority ON public.tasks(priority);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);

CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX idx_task_comments_author_id ON public.task_comments(author_id);
CREATE INDEX idx_task_comments_assignee_user_id ON public.task_comments(assignee_user_id);

CREATE INDEX idx_task_attachments_task_id ON public.task_attachments(task_id);
CREATE INDEX idx_task_attachments_uploaded_by ON public.task_attachments(uploaded_by);
CREATE INDEX idx_task_attachments_assignee_user_id ON public.task_attachments(assignee_user_id);

CREATE INDEX idx_task_assignees_task_id ON public.task_assignees(task_id);
CREATE INDEX idx_task_assignees_user_id ON public.task_assignees(user_id);

CREATE INDEX idx_task_followers_task_id ON public.task_followers(task_id);
CREATE INDEX idx_task_followers_user_id ON public.task_followers(user_id);

CREATE INDEX idx_task_reminders_task_id ON public.task_reminders(task_id);
CREATE INDEX idx_task_reminders_created_by ON public.task_reminders(created_by);

CREATE INDEX idx_task_checklist_task_id ON public.task_checklist(task_id);
CREATE INDEX idx_task_checklist_created_by ON public.task_checklist(created_by);

CREATE INDEX idx_task_timers_task_id ON public.task_timers(task_id);
CREATE INDEX idx_task_timers_user_id ON public.task_timers(user_id);

-- 11. Create view for task time tracking
CREATE VIEW public.v_task_time_by_user AS
SELECT
  tt.task_id,
  tt.user_id,
  SUM(
    CASE
      WHEN tt.end_time IS NOT NULL THEN EXTRACT(EPOCH FROM (tt.end_time - tt.start_time)) / 60
      ELSE EXTRACT(EPOCH FROM (now() - tt.start_time)) / 60
    END
  )::integer AS total_minutes
FROM public.task_timers tt
GROUP BY tt.task_id, tt.user_id;

-- 12. Enable RLS on all tables
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_timers ENABLE ROW LEVEL SECURITY;

-- 13. Create RLS policies for tasks
CREATE POLICY "Users can view their own tasks" ON public.tasks
  FOR SELECT USING (assigned_to = auth.uid());

CREATE POLICY "Users can update their own tasks" ON public.tasks
  FOR UPDATE USING (assigned_to = auth.uid());

CREATE POLICY "Admins and managers can view all tasks" ON public.tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can create tasks" ON public.tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

-- 14. Create permissive policies for task-related tables (for testing)
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

-- 15. Grant permissions
GRANT ALL ON public.tasks TO authenticated;
GRANT ALL ON public.task_comments TO authenticated;
GRANT ALL ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_assignees TO authenticated;
GRANT ALL ON public.task_followers TO authenticated;
GRANT ALL ON public.task_reminders TO authenticated;
GRANT ALL ON public.task_checklist TO authenticated;
GRANT ALL ON public.task_timers TO authenticated;

-- 16. Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 17. Create function to update task last_updated
CREATE OR REPLACE FUNCTION public.update_task_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tasks
  SET last_updated = now()
  WHERE id = COALESCE(NEW.task_id, OLD.task_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 18. Create triggers to update last_updated
CREATE TRIGGER update_task_last_updated_on_comment_insert
  AFTER INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_task_last_updated();

CREATE TRIGGER update_task_last_updated_on_comment_update
  AFTER UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_task_last_updated();

CREATE TRIGGER update_task_last_updated_on_comment_delete
  AFTER DELETE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_task_last_updated();

CREATE TRIGGER update_task_last_updated_on_attachment_insert
  AFTER INSERT ON public.task_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_task_last_updated();

CREATE TRIGGER update_task_last_updated_on_attachment_update
  AFTER UPDATE ON public.task_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_task_last_updated();

CREATE TRIGGER update_task_last_updated_on_attachment_delete
  AFTER DELETE ON public.task_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_task_last_updated();

-- 19. Create function to add creator as assignee
CREATE OR REPLACE FUNCTION public.add_creator_as_assignee()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.task_assignees (task_id, user_id, assigned_at)
  VALUES (NEW.id, NEW.assigned_by, now())
  ON CONFLICT (task_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 20. Create trigger to auto-assign creator
CREATE TRIGGER auto_add_creator_as_assignee
  AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_assignee();
