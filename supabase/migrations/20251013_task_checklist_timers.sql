-- Checklist items per task
create table if not exists public.task_checklist (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  position integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_task_checklist_task on public.task_checklist(task_id);

-- Timers per user per task
create table if not exists public.task_timers (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  start_time timestamptz not null default now(),
  end_time timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_task_timers_task on public.task_timers(task_id);
create index if not exists idx_task_timers_user on public.task_timers(user_id);

-- Helper view to compute total seconds per user per task
create or replace view public.v_task_time_by_user as
select
  task_id,
  user_id,
  sum(extract(epoch from coalesce(end_time, now()) - start_time))::bigint as seconds_spent
from public.task_timers
group by 1,2;

-- Prevent multiple concurrent running timers per user/task
do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='uq_running_timer_per_user_task'
  ) then
    create unique index uq_running_timer_per_user_task
      on public.task_timers(task_id, user_id)
      where end_time is null;
  end if;
end $$;


