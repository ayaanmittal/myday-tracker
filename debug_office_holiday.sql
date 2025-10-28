-- Debug and fix office holiday issues
-- Run this in Supabase SQL Editor

-- Step 1: Check current constraint
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'check_manual_status';

-- Step 2: Check if function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'mark_office_holiday_range';

-- Step 3: Update constraint to allow Office Holiday
ALTER TABLE public.unified_attendance 
DROP CONSTRAINT IF EXISTS check_manual_status;

ALTER TABLE public.unified_attendance 
ADD CONSTRAINT check_manual_status 
CHECK (manual_status IS NULL OR manual_status IN ('present', 'absent', 'leave_granted', 'holiday', 'Office Holiday'));

-- Step 4: Create/Replace the function
CREATE OR REPLACE FUNCTION public.mark_office_holiday_range(
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
    where coalesce(p.is_active, true) = true;
  else
    v_user_ids := user_ids;
  end if;

  -- Insert missing rows for each (user, date) with Office Holiday status
  insert into public.unified_attendance (
    user_id, entry_date, device_info, source, status, manual_status, modification_reason, manual_override_by, manual_override_at
  )
  select u_ids.u_id as user_id,
         g.d::date as entry_date,
         'System Override' as device_info,
         'manual' as source,
         'Office Holiday' as status,
         'Office Holiday'::varchar as manual_status,
         'Bulk office holiday override' as modification_reason,
         v_uid as manual_override_by,
         now() as manual_override_at
  from unnest(v_user_ids) as u_ids(u_id)
  cross join generate_series(start_date, end_date, interval '1 day') as g(d)
  where not exists (
    select 1 from public.unified_attendance ua
    where ua.user_id = u_ids.u_id and ua.entry_date = g.d::date
  );

  get diagnostics v_inserted = row_count;

  -- Update existing rows to reflect office holiday status
  -- Office Holiday always overrides any other status
  update public.unified_attendance ua
  set manual_status = 'Office Holiday',
      status = 'Office Holiday',
      modification_reason = 'Bulk office holiday override',
      manual_override_by = v_uid,
      manual_override_at = now(),
      updated_at = now()
  where ua.user_id = any(v_user_ids)
    and ua.entry_date between start_date and end_date;

  get diagnostics v_updated = row_count;

  return json_build_object(
    'inserted', v_inserted,
    'updated', v_updated
  );
end;
$$;

-- Step 5: Test the function manually
DO $$
DECLARE
  result json;
BEGIN
  -- Test with a small date range
  SELECT public.mark_office_holiday_range('2025-10-20'::date, '2025-10-21'::date, null) INTO result;
  RAISE NOTICE 'Function test result: %', result;
END $$;

-- Step 6: Check what records exist for the test dates
SELECT 
  user_id,
  entry_date,
  status,
  manual_status,
  modification_reason,
  manual_override_at
FROM public.unified_attendance 
WHERE entry_date BETWEEN '2025-10-20' AND '2025-10-21'
ORDER BY entry_date, user_id;

