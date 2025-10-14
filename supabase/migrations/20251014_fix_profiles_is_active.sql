-- Replace function to use profiles.is_active (not profiles.active)
create or replace function public.apply_approved_leaves_for_range(p_start date, p_end date)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_affected int := 0;
  v_last int := 0;
begin
  -- Upsert approved leaves into unified_attendance
  insert into public.unified_attendance (
    user_id, entry_date, device_info, source, status, manual_status,
    modification_reason, manual_override_by, manual_override_at
  )
  select lr.user_id,
         g.d::date,
         'System: Approved Leave',
         'manual',
         'completed',
         'leave_granted',
         coalesce('Approved leave: '||lr.reason,'Approved leave'),
         lr.approved_by,
         now()
  from public.leave_requests lr
  join generate_series(p_start, p_end, interval '1 day') g(d)
    on g.d::date between lr.start_date and lr.end_date
  where lr.status = 'approved'
  on conflict (user_id, entry_date) do update
     set manual_status = excluded.manual_status,
         status = excluded.status,
         modification_reason = excluded.modification_reason,
         manual_override_by = excluded.manual_override_by,
         manual_override_at = now(),
         updated_at = now();

  get diagnostics v_last = row_count;
  v_affected := v_affected + v_last;

  -- Upsert company holidays for all active employees
  insert into public.unified_attendance (
    user_id, entry_date, device_info, source, status, manual_status,
    modification_reason, manual_override_by, manual_override_at
  )
  select p.id,
         ch.holiday_date,
         'System: Company Holiday',
         'manual',
         'completed',
         'leave_granted',
         coalesce('Company holiday: '||ch.title, 'Company holiday'),
         v_uid,
         now()
  from public.company_holidays ch
  join public.profiles p on coalesce(p.is_active, true) = true
  where ch.holiday_date between p_start and p_end
  on conflict (user_id, entry_date) do update
     set manual_status = excluded.manual_status,
         status = excluded.status,
         modification_reason = excluded.modification_reason,
         manual_override_by = excluded.manual_override_by,
         manual_override_at = now(),
         updated_at = now();

  get diagnostics v_last = row_count;
  v_affected := v_affected + v_last;

  return json_build_object('affected', v_affected);
end;
$$;


