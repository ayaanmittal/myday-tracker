-- Fix leaves processing issue
-- This script will process approved leave requests and create leave records

-- Step 1: Check current state
SELECT 'Current state before processing:' as step;
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

-- Step 2: Show approved leave requests that need processing
SELECT 'Approved leave requests that need processing:' as step;
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

-- Step 3: Check employee categories and leave policies
SELECT 'Employee categories and leave policies:' as step;
SELECT 
  ec.name as category_name,
  ec.is_active as category_active,
  COUNT(lp.id) as policy_count
FROM public.employee_categories ec
LEFT JOIN public.leave_policies lp ON lp.employee_category_id = ec.id AND lp.is_active = true
GROUP BY ec.id, ec.name, ec.is_active
ORDER BY ec.name;

-- Step 4: Check leave policies for intern category
SELECT 'Leave policies for intern category:' as step;
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

-- Step 5: Process approved leave requests manually
-- Create leave records for each day in approved leave requests
WITH approved_requests AS (
  SELECT 
    lr.id as request_id,
    lr.user_id,
    p.id as profile_id,
    p.employee_category_id,
    lr.start_date,
    lr.end_date,
    lr.leave_type_id,
    lr.approved_by,
    lr.approved_at,
    lt.name as leave_type_name,
    lt.is_paid as leave_type_default_paid
  FROM public.leave_requests lr
  JOIN public.profiles p ON p.user_id = lr.user_id
  JOIN public.leave_types lt ON lt.id = lr.leave_type_id
  WHERE lr.status = 'approved'
    AND lr.processed = false
),
leave_days AS (
  SELECT 
    ar.request_id,
    ar.user_id,
    ar.profile_id,
    ar.employee_category_id,
    ar.leave_type_id,
    ar.leave_type_name,
    ar.approved_by,
    ar.approved_at,
    ar.leave_type_default_paid,
    generate_series(ar.start_date, ar.end_date, '1 day'::interval)::date as leave_date
  FROM approved_requests ar
),
leave_policies AS (
  SELECT 
    ld.*,
    lp.is_paid as policy_is_paid
  FROM leave_days ld
  LEFT JOIN public.leave_policies lp ON lp.employee_category_id = ld.employee_category_id
    AND lp.leave_type_id = ld.leave_type_id
    AND lp.is_active = true
),
final_leaves AS (
  SELECT 
    lp.*,
    CASE 
      WHEN lp.policy_is_paid IS NOT NULL THEN lp.policy_is_paid
      ELSE lp.leave_type_default_paid
    END as final_is_paid
  FROM leave_policies lp
)
INSERT INTO public.leaves (
  user_id,
  profile_id,
  leave_date,
  leave_type_id,
  leave_type_name,
  is_paid_leave,
  is_approved,
  approved_by,
  approved_at,
  leave_request_id,
  created_by,
  notes
)
SELECT 
  fl.user_id,
  fl.profile_id,
  fl.leave_date,
  fl.leave_type_id,
  fl.leave_type_name,
  fl.final_is_paid,
  true,
  fl.approved_by,
  fl.approved_at,
  fl.request_id,
  fl.approved_by,
  'Auto-generated from approved leave request'
FROM final_leaves fl
WHERE NOT EXISTS (
  SELECT 1 FROM public.leaves l 
  WHERE l.user_id = fl.user_id 
    AND l.leave_date = fl.leave_date
);

-- Step 6: Mark processed leave requests
UPDATE public.leave_requests 
SET processed = true 
WHERE status = 'approved' 
  AND processed = false;

-- Step 7: Check results after processing
SELECT 'Results after processing:' as step;
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
WHERE is_paid_leave = false;

-- Step 8: Show detailed leaves created
SELECT 'Detailed leaves created:' as step;
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

-- Step 9: Test unpaid leave calculation
SELECT 'Unpaid leave calculation test:' as step;
SELECT 
  p.name,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2024-01-01'::DATE) as unpaid_days
FROM public.profiles p
WHERE p.is_active = true
ORDER BY p.name;

-- Step 10: Test complete leave deduction calculation
SELECT 'Complete leave deduction calculation:' as step;
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

