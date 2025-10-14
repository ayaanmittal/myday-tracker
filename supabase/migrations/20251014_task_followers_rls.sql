-- Allow users to view their own follower rows
alter table public.task_followers enable row level security;

drop policy if exists "Users can view their own follower rows" on public.task_followers;
create policy "Users can view their own follower rows" on public.task_followers
  for select using (user_id = auth.uid());


