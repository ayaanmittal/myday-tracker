-- COMPREHENSIVE DEBUG SCRIPT
-- This will help us understand all the issues

-- Step 1: Check all leave requests (any date)
SELECT 'All leave requests (any date):' as step;
SELECT 
  p.name,
  lr.start_date,
  lr.end_date,
  lr.days_requested,
  lr.status,
  lr.processed,
  lt.name as leave_type_name,
  lt.is_paid as leave_type_default_paid
FROM public.profiles p
JOIN public.leave_requests lr ON lr.user_id = p.user_id
JOIN public.leave_types lt ON lt.id = lr.leave_type_id
ORDER BY p.name, lr.start_date;

-- Step 2: Check approved leave requests (any date)
SELECT 'Approved leave requests (any date):' as step;
SELECT 
  p.name,
  lr.start_date,
  lr.end_date,
  lr.days_requested,
  lr.status,
  lr.processed,
  lt.name as leave_type_name,
  lt.is_paid as leave_type_default_paid
FROM public.profiles p
JOIN public.leave_requests lr ON lr.user_id = p.user_id
JOIN public.leave_types lt ON lt.id = lr.leave_type_id
WHERE lr.status = 'approved'
ORDER BY p.name, lr.start_date;

-- Step 3: Check current leaves table (any date)
SELECT 'Current leaves table (any date):' as step;
SELECT 
  p.name,
  l.leave_date,
  l.leave_type_name,
  l.is_paid_leave,
  l.is_approved,
  l.notes
FROM public.profiles p
JOIN public.leaves l ON l.user_id = p.user_id
WHERE p.is_active = true
ORDER BY p.name, l.leave_date;

-- Step 4: Check employee work days configuration
SELECT 'Employee work days configuration:' as step;
SELECT 
  p.name,
  ewd.monday,
  ewd.tuesday,
  ewd.wednesday,
  ewd.thursday,
  ewd.friday,
  ewd.saturday,
  ewd.sunday
FROM public.profiles p
LEFT JOIN public.employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.is_active = true
ORDER BY p.name;

-- Step 5: Check employee salaries
SELECT 'Employee salaries:' as step;
SELECT 
  p.name,
  es.base_salary,
  es.is_active as salary_active,
  es.effective_from,
  es.effective_to
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id
WHERE p.is_active = true
ORDER BY p.name;

-- Step 6: Test work days calculation for October 2025
SELECT 'Work days calculation for October 2025:' as step;
SELECT 
  p.name,
  ewd.monday,
  ewd.tuesday,
  ewd.wednesday,
  ewd.thursday,
  ewd.friday,
  ewd.saturday,
  ewd.sunday
FROM public.profiles p
LEFT JOIN public.employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.is_active = true
ORDER BY p.name;

-- Step 7: Test daily rate calculation for October 2025
SELECT 'Daily rate calculation for October 2025:' as step;
SELECT 
  p.name,
  es.base_salary,
  public.calculate_daily_salary_rate(p.user_id, '2025-10-01'::DATE) as daily_rate
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
WHERE p.is_active = true
ORDER BY p.name;

-- Step 8: Test unpaid leave calculation for October 2025
SELECT 'Unpaid leave calculation for October 2025:' as step;
SELECT 
  p.name,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2025-10-01'::DATE) as unpaid_days
FROM public.profiles p
WHERE p.is_active = true
ORDER BY p.name;

-- Step 9: Check if leaves table exists and has the right structure
SELECT 'Leaves table structure:' as step;
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'leaves' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 10: Check if functions exist
SELECT 'Check if functions exist:' as step;
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_name IN (
  'calculate_daily_salary_rate',
  'calculate_unpaid_leave_days_for_salary',
  'get_employee_work_days_summary'
)
  AND routine_schema = 'public';

-- Step 11: Count total records in each table
SELECT 'Record counts:' as step;
SELECT 
  'leave_requests' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_records,
  COUNT(*) FILTER (WHERE status = 'approved' AND processed = false) as unprocessed_approved
FROM public.leave_requests
UNION ALL
SELECT 
  'leaves' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE is_paid_leave = true) as paid_leaves,
  COUNT(*) FILTER (WHERE is_paid_leave = false) as unpaid_leaves
FROM public.leaves
UNION ALL
SELECT 
  'employee_work_days' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE monday = true) as monday_workers,
  COUNT(*) FILTER (WHERE tuesday = true) as tuesday_workers
FROM public.employee_work_days
UNION ALL
SELECT 
  'employee_salaries' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE is_active = true) as active_salaries,
  COUNT(*) FILTER (WHERE base_salary > 0) as positive_salaries
FROM public.employee_salaries;
