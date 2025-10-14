-- Allow admins and managers to delete tasks and ensure cascading cleanup

-- 1) Ensure RLS is enabled on tasks
alter table public.tasks enable row level security;

-- 2) Create delete policy for admins and managers
drop policy if exists "Admins and managers can delete tasks" on public.tasks;
create policy "Admins and managers can delete tasks" on public.tasks
  for delete using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
      and ur.role in ('admin', 'manager')
    )
  );

-- 3) Ensure ON DELETE CASCADE on task-related tables so a task deletion cleans up children
-- Helper DO block to recreate FK with ON DELETE CASCADE if missing, per table

do $$ begin
  -- task_comments.task_id
  if exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public' and tc.table_name = 'task_comments' and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'task_id'
  ) then
    begin
      alter table public.task_comments drop constraint if exists task_comments_task_id_fkey;
    exception when undefined_object then null;
    end;
  end if;
  alter table public.task_comments
    add constraint task_comments_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade;
end $$;

do $$ begin
  -- task_attachments.task_id
  if exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public' and tc.table_name = 'task_attachments' and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'task_id'
  ) then
    begin
      alter table public.task_attachments drop constraint if exists task_attachments_task_id_fkey;
    exception when undefined_object then null;
    end;
  end if;
  alter table public.task_attachments
    add constraint task_attachments_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade;
end $$;

do $$ begin
  -- task_assignees.task_id
  if exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public' and tc.table_name = 'task_assignees' and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'task_id'
  ) then
    begin
      alter table public.task_assignees drop constraint if exists task_assignees_task_id_fkey;
    exception when undefined_object then null;
    end;
  end if;
  alter table public.task_assignees
    add constraint task_assignees_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade;
end $$;

do $$ begin
  -- task_followers.task_id
  if exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public' and tc.table_name = 'task_followers' and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'task_id'
  ) then
    begin
      alter table public.task_followers drop constraint if exists task_followers_task_id_fkey;
    exception when undefined_object then null;
    end;
  end if;
  alter table public.task_followers
    add constraint task_followers_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade;
end $$;

do $$ begin
  -- task_reminders.task_id
  if exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public' and tc.table_name = 'task_reminders' and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'task_id'
  ) then
    begin
      alter table public.task_reminders drop constraint if exists task_reminders_task_id_fkey;
    exception when undefined_object then null;
    end;
  end if;
  alter table public.task_reminders
    add constraint task_reminders_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade;
end $$;

do $$ begin
  -- task_checklist.task_id
  if exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public' and tc.table_name = 'task_checklist' and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'task_id'
  ) then
    begin
      alter table public.task_checklist drop constraint if exists task_checklist_task_id_fkey;
    exception when undefined_object then null;
    end;
  end if;
  alter table public.task_checklist
    add constraint task_checklist_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade;
end $$;

do $$ begin
  -- task_timers.task_id
  if exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public' and tc.table_name = 'task_timers' and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'task_id'
  ) then
    begin
      alter table public.task_timers drop constraint if exists task_timers_task_id_fkey;
    exception when undefined_object then null;
    end;
  end if;
  alter table public.task_timers
    add constraint task_timers_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade;
end $$;


