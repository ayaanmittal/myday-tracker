-- Make user_ids optional (NULL => all active employees), and fully qualify columns
create or replace function public.mark_users_holiday_range(
  start_date date,
  end_date date,
  user_ids uuid[] default null
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin_or_manager boolean;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_user_ids uuid[];
begin
  -- Authorization: only admins/managers may run
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_uid and ur.role in ('admin','manager')
  ) into v_is_admin_or_manager;

  if not coalesce(v_is_admin_or_manager, false) then
    raise exception 'Not authorized';
  end if;

  if start_date is null or end_date is null or start_date > end_date then
    raise exception 'Invalid date range';
  end if;

  -- If no users provided, use all active employees
  if user_ids is null or array_length(user_ids, 1) is null or array_length(user_ids, 1) = 0 then
    select coalesce(array_agg(p.id), '{}')
    into v_user_ids
    from public.profiles p
    where coalesce(p.active, true) = true; -- assumes profiles.active flag; adjust if needed
  else
    v_user_ids := user_ids;
  end if;

  -- Insert missing rows for each (user, date)
  insert into public.unified_attendance (
    user_id, entry_date, device_info, source, status, manual_status, modification_reason, manual_override_by, manual_override_at
  )
  select u_ids.u_id as user_id,
         g.d::date as entry_date,
         'System Override' as device_info,
         'manual' as source,
         'completed' as status,
         'leave_granted'::varchar as manual_status,
         'Bulk holiday override' as modification_reason,
         v_uid as manual_override_by,
         now() as manual_override_at
  from unnest(v_user_ids) as u_ids(u_id)
  cross join generate_series(start_date, end_date, interval '1 day') as g(d)
  where not exists (
    select 1 from public.unified_attendance ua
    where ua.user_id = u_ids.u_id and ua.entry_date = g.d::date
  );

  get diagnostics v_inserted = row_count;

  -- Update existing rows to reflect leave status
  update public.unified_attendance ua
  set manual_status = 'leave_granted',
      status = 'completed',
      modification_reason = 'Bulk holiday override',
      manual_override_by = v_uid,
      manual_override_at = now(),
      updated_at = now()
  where ua.user_id = any(v_user_ids)
    and ua.entry_date between start_date and end_date
    and (ua.manual_status is distinct from 'leave_granted' or ua.status is distinct from 'completed');

  get diagnostics v_updated = row_count;

  return json_build_object(
    'inserted', v_inserted,
    'updated', v_updated
  );
end;
$$;


