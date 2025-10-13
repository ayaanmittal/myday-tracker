-- Complete task system setup with all required tables and policies
-- This migration ensures everything is set up correctly

-- 1. Create task_comments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  assignee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create task_attachments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.task_attachments (
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

-- 3. Create task_assignees table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

-- 4. Create task_followers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.task_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

-- 5. Create task_reminders table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.task_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  remind_at timestamptz NOT NULL,
  note text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Create task_checklist table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.task_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_done boolean DEFAULT false NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sort_order integer NOT NULL DEFAULT 0
);

-- 7. Create task_timers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.task_timers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  duration_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Add last_updated to tasks if it doesn't exist
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS last_updated timestamptz DEFAULT now();

-- 9. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments (task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_author_id ON public.task_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_assignee_user_id ON public.task_comments (assignee_user_id);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments (task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by ON public.task_attachments (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_task_attachments_assignee_user_id ON public.task_attachments (assignee_user_id);

CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON public.task_assignees (task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON public.task_assignees (user_id);

CREATE INDEX IF NOT EXISTS idx_task_followers_task_id ON public.task_followers (task_id);
CREATE INDEX IF NOT EXISTS idx_task_followers_user_id ON public.task_followers (user_id);

CREATE INDEX IF NOT EXISTS idx_task_reminders_task_id ON public.task_reminders (task_id);
CREATE INDEX IF NOT EXISTS idx_task_reminders_created_by ON public.task_reminders (created_by);

CREATE INDEX IF NOT EXISTS idx_task_checklist_task_id ON public.task_checklist (task_id);
CREATE INDEX IF NOT EXISTS idx_task_checklist_created_by ON public.task_checklist (created_by);

CREATE INDEX IF NOT EXISTS idx_task_timers_task_id ON public.task_timers (task_id);
CREATE INDEX IF NOT EXISTS idx_task_timers_user_id ON public.task_timers (user_id);

-- 10. Create view for task time tracking
-- First drop the existing view if it exists
DROP VIEW IF EXISTS public.v_task_time_by_user;

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

-- 11. Enable RLS on all tables
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_timers ENABLE ROW LEVEL SECURITY;

-- 12. Drop existing policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_comments;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_attachments;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_assignees;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_followers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_reminders;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_checklist;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_timers;

-- 13. Create permissive policies for testing
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

-- 14. Grant permissions
GRANT ALL ON public.task_comments TO authenticated;
GRANT ALL ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_assignees TO authenticated;
GRANT ALL ON public.task_followers TO authenticated;
GRANT ALL ON public.task_reminders TO authenticated;
GRANT ALL ON public.task_checklist TO authenticated;
GRANT ALL ON public.task_timers TO authenticated;

-- 15. Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 16. Create function to update task last_updated
CREATE OR REPLACE FUNCTION public.update_task_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tasks
  SET last_updated = now()
  WHERE id = COALESCE(NEW.task_id, OLD.task_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 17. Create triggers to update last_updated
DROP TRIGGER IF EXISTS update_task_last_updated_on_comment_insert ON public.task_comments;
CREATE TRIGGER update_task_last_updated_on_comment_insert
  AFTER INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_task_last_updated();

DROP TRIGGER IF EXISTS update_task_last_updated_on_attachment_insert ON public.task_attachments;
CREATE TRIGGER update_task_last_updated_on_attachment_insert
  AFTER INSERT ON public.task_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_task_last_updated();

-- 18. Create function to add creator as assignee
CREATE OR REPLACE FUNCTION public.add_creator_as_assignee()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.task_assignees (task_id, user_id, assigned_at)
  VALUES (NEW.id, NEW.assigned_by, now())
  ON CONFLICT (task_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 19. Create trigger to auto-assign creator
DROP TRIGGER IF EXISTS auto_add_creator_as_assignee ON public.tasks;
CREATE TRIGGER auto_add_creator_as_assignee
  AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_assignee();
