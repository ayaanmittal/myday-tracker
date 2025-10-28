-- DEBUG LEAVE REQUESTS SCRIPT
-- This will help us understand what's happening with leave requests

-- Step 1: Check all leave requests
SELECT 'All leave requests:' as step;
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

-- Step 2: Check approved leave requests specifically
SELECT 'Approved leave requests:' as step;
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

-- Step 3: Check unprocessed approved leave requests
SELECT 'Unprocessed approved leave requests:' as step;
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
WHERE lr.status = 'approved' AND lr.processed = false
ORDER BY p.name, lr.start_date;

-- Step 4: Check current leaves table
SELECT 'Current leaves table:' as step;
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

-- Step 5: Check employee categories
SELECT 'Employee categories:' as step;
SELECT 
  p.name,
  ec.name as category_name,
  ec.is_active as category_active
FROM public.profiles p
JOIN public.employee_categories ec ON ec.id = p.employee_category_id
WHERE p.is_active = true
ORDER BY p.name;

-- Step 6: Check leave policies
SELECT 'Leave policies:' as step;
SELECT 
  ec.name as category_name,
  lt.name as leave_type_name,
  lp.is_paid,
  lp.max_days_per_year,
  lp.requires_approval
FROM public.employee_categories ec
JOIN public.leave_policies lp ON lp.employee_category_id = ec.id
JOIN public.leave_types lt ON lt.id = lp.leave_type_id
WHERE lp.is_active = true
ORDER BY ec.name, lt.name;

-- Step 7: Check if leaves table exists and has the right structure
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

-- Step 8: Count total records in each table
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

