-- CHECK LEAVE REQUESTS SCRIPT
-- This will show us exactly what leave requests exist and their details

-- Step 1: Show all leave requests with details
SELECT 'All leave requests with details:' as step;
SELECT 
  p.name,
  lr.start_date,
  lr.end_date,
  lr.days_requested,
  lr.status,
  lr.processed,
  lr.approved_by,
  lr.approved_at,
  lt.name as leave_type_name,
  lt.is_paid as leave_type_default_paid,
  ec.name as employee_category,
  lp.is_paid as policy_is_paid
FROM public.profiles p
JOIN public.leave_requests lr ON lr.user_id = p.user_id
JOIN public.leave_types lt ON lt.id = lr.leave_type_id
JOIN public.employee_categories ec ON ec.id = p.employee_category_id
LEFT JOIN public.leave_policies lp ON lp.employee_category_id = p.employee_category_id 
  AND lp.leave_type_id = lr.leave_type_id 
  AND lp.is_active = true
ORDER BY p.name, lr.start_date;

-- Step 2: Show approved leave requests that should be processed
SELECT 'Approved leave requests that should be processed:' as step;
SELECT 
  p.name,
  lr.start_date,
  lr.end_date,
  lr.days_requested,
  lr.status,
  lr.processed,
  lt.name as leave_type_name,
  lt.is_paid as leave_type_default_paid,
  ec.name as employee_category,
  lp.is_paid as policy_is_paid,
  COALESCE(lp.is_paid, lt.is_paid) as final_is_paid
FROM public.profiles p
JOIN public.leave_requests lr ON lr.user_id = p.user_id
JOIN public.leave_types lt ON lt.id = lr.leave_type_id
JOIN public.employee_categories ec ON ec.id = p.employee_category_id
LEFT JOIN public.leave_policies lp ON lp.employee_category_id = p.employee_category_id 
  AND lp.leave_type_id = lr.leave_type_id 
  AND lp.is_active = true
WHERE lr.status = 'approved'
ORDER BY p.name, lr.start_date;

-- Step 3: Check if leaves table exists and has the right structure
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

-- Step 4: Check current leaves table content
SELECT 'Current leaves table content:' as step;
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

-- Step 5: Count records in each table
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
FROM public.leaves;
