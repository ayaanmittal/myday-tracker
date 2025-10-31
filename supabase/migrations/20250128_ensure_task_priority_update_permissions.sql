-- Ensure task priority updates work for all authorized users
-- This migration drops ALL existing UPDATE policies and creates a comprehensive one

-- Ensure RLS is enabled
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing UPDATE policies to start fresh
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins and managers can update all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins can update all tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_consolidated" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;

-- Create a comprehensive UPDATE policy that allows:
-- 1. Primary assignee (tasks.assigned_to)
-- 2. Additional assignees (via task_assignees table)
-- 3. Task creator (tasks.assigned_by)
-- 4. Admins and managers (via user_roles table)
CREATE POLICY "tasks_update_comprehensive" ON public.tasks
  FOR UPDATE 
  USING (
    -- Primary assignee
    assigned_to = auth.uid()
    OR
    -- Additional assignees
    EXISTS (
      SELECT 1
      FROM public.task_assignees ta
      WHERE ta.task_id = public.tasks.id
        AND ta.user_id = auth.uid()
    )
    OR
    -- Task creator
    assigned_by = auth.uid()
    OR
    -- Admins / managers
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    -- Same conditions for the new values
    assigned_to = auth.uid()
    OR
    EXISTS (
      SELECT 1
      FROM public.task_assignees ta
      WHERE ta.task_id = public.tasks.id
        AND ta.user_id = auth.uid()
    )
    OR
    assigned_by = auth.uid()
    OR
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'manager')
    )
  );



