-- Process existing approved leave requests into the leaves table
-- This script will populate the leaves table with all approved leave requests

-- Step 1: Check current state before processing
SELECT 'Step 1: Current state before processing' as step;
SELECT 
  'Leave Requests' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_records,
  COUNT(*) FILTER (WHERE status = 'approved' AND processed = false) as unprocessed_approved
FROM public.leave_requests
UNION ALL
SELECT 
  'Leaves' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE is_paid_leave = true) as paid_leaves,
  COUNT(*) FILTER (WHERE is_paid_leave = false) as unpaid_leaves
FROM public.leaves;

-- Step 2: Check approved leave requests that need processing
SELECT 'Step 2: Approved leave requests that need processing' as step;
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

-- Step 3: Check employee categories and their leave policies
SELECT 'Step 3: Employee categories and leave policies' as step;
SELECT 
  ec.name as category_name,
  ec.is_active as category_active,
  COUNT(lp.id) as policy_count
FROM public.employee_categories ec
LEFT JOIN public.leave_policies lp ON lp.employee_category_id = ec.id AND lp.is_active = true
GROUP BY ec.id, ec.name, ec.is_active
ORDER BY ec.name;

-- Step 4: Check leave policies for intern category specifically
SELECT 'Step 4: Leave policies for intern category' as step;
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

-- Step 5: Process approved leave requests using the populate function
SELECT 'Step 5: Processing approved leave requests' as step;
SELECT public.populate_leaves_from_requests() as leaves_created;

-- Step 6: Check leaves table after processing
SELECT 'Step 6: Leaves table after processing' as step;
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

-- Step 7: Check unpaid leave calculation after processing
SELECT 'Step 7: Unpaid leave calculation after processing' as step;
SELECT 
  p.name,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2024-01-01'::DATE) as unpaid_days
FROM public.profiles p
WHERE p.is_active = true
ORDER BY p.name;

-- Step 8: Check complete leave deduction calculation
SELECT 'Step 8: Complete leave deduction calculation' as step;
SELECT 
  p.name,
  es.base_salary,
  public.calculate_daily_salary_rate(p.user_id, '2024-01-01'::DATE) as daily_rate,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2024-01-01'::DATE) as unpaid_days,
  public.calculate_month_leave_deductions(p.user_id, '2024-01-01'::DATE) as deduction_calculation
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
WHERE p.is_active = true
ORDER BY p.name;

-- Step 9: Summary of processing results
SELECT 'Step 9: Summary of processing results' as step;
SELECT 
  'Total Leaves Created' as metric,
  COUNT(*) as value
FROM public.leaves
UNION ALL
SELECT 
  'Paid Leaves' as metric,
  COUNT(*) as value
FROM public.leaves
WHERE is_paid_leave = true
UNION ALL
SELECT 
  'Unpaid Leaves' as metric,
  COUNT(*) as value
FROM public.leaves
WHERE is_paid_leave = false
UNION ALL
SELECT 
  'Unprocessed Leave Requests' as metric,
  COUNT(*) as value
FROM public.leave_requests
WHERE status = 'approved' AND processed = false;



