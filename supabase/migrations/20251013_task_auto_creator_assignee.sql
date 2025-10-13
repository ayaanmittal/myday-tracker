-- Automatically add task creator as an assignee on task creation

create or replace function public.add_creator_as_assignee() returns trigger as $$
begin
  -- Insert creator as an assignee; ignore if already present
  insert into public.task_assignees(task_id, user_id)
  values (NEW.id, NEW.assigned_by)
  on conflict (task_id, user_id) do nothing;
  return NEW;
end; $$ language plpgsql;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'tr_tasks_add_creator_assignee') then
    create trigger tr_tasks_add_creator_assignee
    after insert on public.tasks
    for each row execute function public.add_creator_as_assignee();
  end if;
end $$;


