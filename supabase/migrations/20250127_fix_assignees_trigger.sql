-- Fix task assignees issue: Remove trigger that adds creator as assignee
-- The task creator should only be shown as "Assigned By", not as an assignee

-- 1. Drop the trigger that automatically adds creator as assignee
DROP TRIGGER IF EXISTS auto_add_creator_as_assignee ON public.tasks;
DROP TRIGGER IF EXISTS tr_tasks_add_creator_assignee ON public.tasks;

-- 2. Drop the function that adds creator as assignee
DROP FUNCTION IF EXISTS public.add_creator_as_assignee();

-- 3. Clean up any existing creator entries from task_assignees
-- Remove entries where user_id = assigned_by (creator) but keep primary assignee
DELETE FROM public.task_assignees 
WHERE EXISTS (
  SELECT 1 FROM public.tasks t 
  WHERE t.id = task_assignees.task_id 
  AND t.assigned_by = task_assignees.user_id
  AND t.assigned_to != task_assignees.user_id  -- Keep primary assignee
);

-- 4. Keep the trigger that ensures primary assignee is in task_assignees
-- This is still needed for proper functionality
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_tasks_primary_assignee_sync') THEN
    CREATE TRIGGER tr_tasks_primary_assignee_sync
    AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.ensure_primary_assignee_in_task_assignees();
  END IF;
END $$;
