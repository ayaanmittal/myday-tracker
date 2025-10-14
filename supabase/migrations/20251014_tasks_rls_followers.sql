-- Allow followers to view tasks they follow
alter table public.tasks enable row level security;

drop policy if exists "Followers can view followed tasks" on public.tasks;
create policy "Followers can view followed tasks" on public.tasks
  for select using (
    exists (
      select 1 from public.task_followers tf
      where tf.task_id = id and tf.user_id = auth.uid()
    )
  );


