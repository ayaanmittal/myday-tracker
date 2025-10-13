-- Fix the view column name issue and ensure RLS policies are correct
-- This migration handles the existing view and sets up proper RLS

-- 1. Drop and recreate the view with the correct column name
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

-- 2. Ensure all required fields exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'task_comments' AND column_name = 'assignee_user_id') THEN
    ALTER TABLE public.task_comments 
    ADD COLUMN assignee_user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'task_attachments' AND column_name = 'assignee_user_id') THEN
    ALTER TABLE public.task_attachments 
    ADD COLUMN assignee_user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tasks' AND column_name = 'last_updated') THEN
    ALTER TABLE public.tasks 
    ADD COLUMN last_updated timestamptz DEFAULT now();
  END IF;
END $$;

-- 3. Enable RLS on all task tables
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_timers ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_comments;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_attachments;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_assignees;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_followers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_reminders;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_checklist;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_timers;

-- 5. Create permissive policies for testing
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

-- 6. Grant permissions
GRANT ALL ON public.task_comments TO authenticated;
GRANT ALL ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_assignees TO authenticated;
GRANT ALL ON public.task_followers TO authenticated;
GRANT ALL ON public.task_reminders TO authenticated;
GRANT ALL ON public.task_checklist TO authenticated;
GRANT ALL ON public.task_timers TO authenticated;

-- 7. Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
