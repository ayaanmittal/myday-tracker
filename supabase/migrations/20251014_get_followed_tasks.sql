-- Return tasks that the current auth user follows
create or replace function public.get_followed_tasks()
returns setof public.tasks
language sql
security definer
set search_path = public
as $$
  select t.*
  from public.tasks t
  join public.task_followers tf on tf.task_id = t.id
  where tf.user_id = auth.uid();
$$;


