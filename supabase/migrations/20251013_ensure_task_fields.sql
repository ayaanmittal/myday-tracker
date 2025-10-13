-- Ensure all required fields exist for task functionality
-- This migration makes sure all necessary columns and tables exist

-- Ensure task_comments has all required fields
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'task_comments' AND column_name = 'assignee_user_id') THEN
    ALTER TABLE public.task_comments 
    ADD COLUMN assignee_user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Ensure task_attachments has all required fields
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'task_attachments' AND column_name = 'assignee_user_id') THEN
    ALTER TABLE public.task_attachments 
    ADD COLUMN assignee_user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Ensure tasks has last_updated field
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tasks' AND column_name = 'last_updated') THEN
    ALTER TABLE public.tasks 
    ADD COLUMN last_updated timestamptz DEFAULT now();
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments (task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_author_id ON public.task_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_assignee_user_id ON public.task_comments (assignee_user_id);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments (task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by ON public.task_attachments (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_task_attachments_assignee_user_id ON public.task_attachments (assignee_user_id);

-- Ensure RLS is enabled and create simple policies
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users" ON public.task_comments;
DROP POLICY IF EXISTS "Allow authenticated users" ON public.task_attachments;

-- Create simple permissive policies for testing
CREATE POLICY "Allow authenticated users" ON public.task_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users" ON public.task_attachments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.task_comments TO authenticated;
GRANT ALL ON public.task_attachments TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
