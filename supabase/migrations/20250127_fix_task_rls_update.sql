-- Align tasks UPDATE permissions with UI capabilities
-- Allows updates by:
-- - Primary assignee (tasks.assigned_to)
-- - Additional assignees (public.task_assignees)
-- - Task creator (tasks.assigned_by)
-- - Admins and managers (public.user_roles)

-- Ensure RLS is enabled
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing UPDATE policies to replace with a single consolidated one
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins and managers can update all tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_consolidated" ON public.tasks;

-- Create consolidated UPDATE policy
CREATE POLICY "tasks_update_consolidated" ON public.tasks
  FOR UPDATE USING (
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
  );


