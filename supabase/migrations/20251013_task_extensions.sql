-- Task extensions: comments, attachments, assignees, followers, reminders
-- Safe to run multiple times (IF NOT EXISTS where possible)

-- Comments on tasks
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  content text not null,
  created_at timestamptz not null default now()
);

-- Attachments metadata; actual files should be stored in Supabase Storage bucket `task-attachments`
create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  file_name text not null,
  file_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

-- Multiple assignees per task (optional; keep tasks.assigned_to for primary assignee)
create table if not exists public.task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  unique(task_id, user_id)
);

-- Followers who get notifications
create table if not exists public.task_followers (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  followed_at timestamptz not null default now(),
  unique(task_id, user_id)
);

-- Reminders for a task
create table if not exists public.task_reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  remind_at timestamptz not null,
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_task_comments_task on public.task_comments(task_id);
create index if not exists idx_task_attachments_task on public.task_attachments(task_id);
create index if not exists idx_task_assignees_task on public.task_assignees(task_id);
create index if not exists idx_task_followers_task on public.task_followers(task_id);
create index if not exists idx_task_reminders_task on public.task_reminders(task_id);


