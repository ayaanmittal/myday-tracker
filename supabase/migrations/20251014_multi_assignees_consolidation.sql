-- Multi-assignees consolidation: ensure single task id with multiple collaborators
-- - Keep tasks.assigned_to as primary assignee
-- - Use task_assignees for additional assignees (unique per task)
-- - Ensure primary assignee is always present in task_assignees via trigger
-- - Make comments/attachments visible to all assignees and followers via RLS

-- 1) Ensure task_assignees table exists and has uniqueness
create table if not exists public.task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique(task_id, user_id)
);

create index if not exists idx_task_assignees_task_id on public.task_assignees(task_id);
create index if not exists idx_task_assignees_user_id on public.task_assignees(user_id);

-- 2) Backfill: ensure each task's primary assignee appears in task_assignees
insert into public.task_assignees (task_id, user_id)
select t.id, t.assigned_to
from public.tasks t
left join public.task_assignees ta
  on ta.task_id = t.id and ta.user_id = t.assigned_to
where ta.id is null;

-- 3) Trigger to maintain primary assignee presence on insert/update of tasks
create or replace function public.ensure_primary_assignee_in_task_assignees() returns trigger as $$
begin
  -- Insert the primary assignee row if missing
  insert into public.task_assignees (task_id, user_id)
  values (new.id, new.assigned_to)
  on conflict (task_id, user_id) do nothing;
  return new;
end;
$$ language plpgsql;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'tr_tasks_primary_assignee_sync') then
    create trigger tr_tasks_primary_assignee_sync
    after insert or update of assigned_to on public.tasks
    for each row execute function public.ensure_primary_assignee_in_task_assignees();
  end if;
end $$;

-- 4) Optional targeting fields for comments/attachments already present; ensure existence
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'task_comments' and column_name = 'assignee_user_id'
  ) then
    alter table public.task_comments add column assignee_user_id uuid references auth.users(id) on delete set null;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'task_attachments' and column_name = 'assignee_user_id'
  ) then
    alter table public.task_attachments add column assignee_user_id uuid references auth.users(id) on delete set null;
  end if;
end $$;

-- 5) RLS: Ensure all assignees (primary or additional) can see/edit comments & attachments
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;

-- Drop old policies if they exist (defensive)
drop policy if exists "task_comments_assignees_can_select" on public.task_comments;
drop policy if exists "task_comments_assignees_can_insert" on public.task_comments;
drop policy if exists "task_attachments_assignees_can_select" on public.task_attachments;
drop policy if exists "task_attachments_assignees_can_insert" on public.task_attachments;

-- Helper: check if auth user is assigned (primary or additional) or follower
create or replace function public.is_task_visible_to_user(p_task_id uuid, p_user_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.tasks t where t.id = p_task_id and (t.assigned_to = p_user_id)
    union all
    select 1 from public.task_assignees ta where ta.task_id = p_task_id and ta.user_id = p_user_id
    union all
    select 1 from public.task_followers tf where tf.task_id = p_task_id and tf.user_id = p_user_id
  );
$$;

-- Comments policies
create policy "task_comments_assignees_can_select" on public.task_comments
for select using (
  public.is_task_visible_to_user(task_id, auth.uid())
);

create policy "task_comments_assignees_can_insert" on public.task_comments
for insert with check (
  public.is_task_visible_to_user(task_id, auth.uid()) and auth.uid() = author_id
);

-- Attachments policies
create policy "task_attachments_assignees_can_select" on public.task_attachments
for select using (
  public.is_task_visible_to_user(task_id, auth.uid())
);

create policy "task_attachments_assignees_can_insert" on public.task_attachments
for insert with check (
  public.is_task_visible_to_user(task_id, auth.uid()) and auth.uid() = uploaded_by
);

-- Indexes to keep things snappy
create index if not exists idx_task_comments_task_id on public.task_comments(task_id);
create index if not exists idx_task_comments_author_id on public.task_comments(author_id);
create index if not exists idx_task_attachments_task_id on public.task_attachments(task_id);
create index if not exists idx_task_attachments_uploaded_by on public.task_attachments(uploaded_by);


