-- Debug current leaves system state
-- Check what's happening with leave requests and leaves table

-- Step 1: Check if leaves table exists and its structure
SELECT 'Step 1: Check leaves table structure' as step;
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'leaves' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Check current leaves table content
SELECT 'Step 2: Check current leaves table content' as step;
SELECT COUNT(*) as total_leaves FROM public.leaves;

-- Step 3: Check leave requests status
SELECT 'Step 3: Check leave requests status' as step;
SELECT 
  lr.status,
  lr.processed,
  COUNT(*) as count
FROM public.leave_requests lr
GROUP BY lr.status, lr.processed
ORDER BY lr.status, lr.processed;

-- Step 4: Check approved leave requests that need processing
SELECT 'Step 4: Check approved leave requests that need processing' as step;
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

-- Step 5: Check employee categories and their leave policies
SELECT 'Step 5: Check employee categories and leave policies' as step;
SELECT 
  ec.name as category_name,
  ec.is_active as category_active,
  COUNT(lp.id) as policy_count
FROM public.employee_categories ec
LEFT JOIN public.leave_policies lp ON lp.employee_category_id = ec.id AND lp.is_active = true
GROUP BY ec.id, ec.name, ec.is_active
ORDER BY ec.name;

-- Step 6: Check leave policies for intern category
SELECT 'Step 6: Check leave policies for intern category' as step;
SELECT 
  ec.name as category_name,
  lt.name as leave_type_name,
  lp.is_paid,
  lp.max_days_per_year,
  lp.requires_approval
FROM public.employee_categories ec
JOIN public.leave_policies lp ON lp.employee_category_id = ec.id
JOIN public.leave_types lt ON lt.id = lp.leave_type_id
WHERE ec.name ILIKE '%intern%'
  AND lp.is_active = true
ORDER BY ec.name, lt.name;

-- Step 7: Check if populate_leaves_from_requests function exists
SELECT 'Step 7: Check if populate_leaves_from_requests function exists' as step;
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_name = 'populate_leaves_from_requests'
  AND routine_schema = 'public';

-- Step 8: Check employee leave settings
SELECT 'Step 8: Check employee leave settings' as step;
SELECT 
  p.name,
  ec.name as category_name,
  els.is_custom_settings,
  els.custom_leave_days
FROM public.profiles p
JOIN public.employee_categories ec ON ec.id = p.employee_category_id
LEFT JOIN public.employee_leave_settings els ON els.user_id = p.user_id
WHERE p.is_active = true
ORDER BY p.name;

-- Step 9: Test the populate function if it exists
SELECT 'Step 9: Test populate function' as step;
SELECT public.populate_leaves_from_requests() as leaves_created;

-- Step 10: Check leaves table after processing
SELECT 'Step 10: Check leaves table after processing' as step;
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

-- Step 11: Check unpaid leave calculation after processing
SELECT 'Step 11: Check unpaid leave calculation after processing' as step;
SELECT 
  p.name,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2024-01-01'::DATE) as unpaid_days
FROM public.profiles p
WHERE p.is_active = true
ORDER BY p.name;

