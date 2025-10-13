-- Extend tasks and comment/attachment schema for richer dialog

alter table if exists public.tasks
  add column if not exists last_updated timestamptz default now();

-- Track per-assignee targeting on comments and attachments (optional)
alter table if exists public.task_comments
  add column if not exists assignee_user_id uuid references auth.users(id);

alter table if exists public.task_attachments
  add column if not exists assignee_user_id uuid references auth.users(id);

-- Maintain last_updated via triggers on changes
create or replace function public.bump_task_last_updated() returns trigger as $$
begin
  update public.tasks set last_updated = now(), updated_at = now() where id = coalesce(NEW.task_id, OLD.task_id);
  return NEW;
end; $$ language plpgsql;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'tr_task_comments_bump_last_updated') then
    create trigger tr_task_comments_bump_last_updated
    after insert or update or delete on public.task_comments
    for each row execute function public.bump_task_last_updated();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'tr_task_attachments_bump_last_updated') then
    create trigger tr_task_attachments_bump_last_updated
    after insert or update or delete on public.task_attachments
    for each row execute function public.bump_task_last_updated();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'tr_tasks_bump_last_updated') then
    create trigger tr_tasks_bump_last_updated
    after update on public.tasks
    for each row execute function public.bump_task_last_updated();
  end if;
end $$;


