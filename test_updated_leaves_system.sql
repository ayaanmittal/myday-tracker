-- Test script for the updated leaves system with employee settings
-- This script tests the new paid/unpaid detection based on employee settings

-- Step 1: Check employee categories and leave policies
SELECT 'Step 1: Check employee categories and leave policies' as step;
SELECT 
  ec.name as category_name,
  lt.name as leave_type_name,
  lp.is_paid,
  lp.max_days_per_year,
  lp.requires_approval
FROM public.employee_categories ec
JOIN public.leave_policies lp ON lp.employee_category_id = ec.id
JOIN public.leave_types lt ON lt.id = lp.leave_type_id
WHERE ec.is_active = true AND lp.is_active = true
ORDER BY ec.name, lt.name;

-- Step 2: Check employee leave settings
SELECT 'Step 2: Check employee leave settings' as step;
SELECT 
  p.name,
  ec.name as category_name,
  els.is_custom_settings,
  els.custom_leave_days,
  els.notes
FROM public.profiles p
JOIN public.employee_categories ec ON ec.id = p.employee_category_id
LEFT JOIN public.employee_leave_settings els ON els.user_id = p.user_id
WHERE p.is_active = true
ORDER BY p.name;

-- Step 3: Check leave requests and their processing status
SELECT 'Step 3: Check leave requests and processing status' as step;
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
WHERE p.is_active = true
ORDER BY p.name, lr.start_date;

-- Step 4: Test leave policy detection for specific employees
SELECT 'Step 4: Test leave policy detection' as step;
SELECT 
  p.name,
  lt.name as leave_type_name,
  public.get_leave_policy_for_employee(p.user_id, lt.id) as policy_info
FROM public.profiles p
CROSS JOIN public.leave_types lt
WHERE p.is_active = true
  AND lt.is_active = true
LIMIT 10;

-- Step 5: Check current leaves table status
SELECT 'Step 5: Check current leaves table' as step;
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

-- Step 6: Test unpaid leave calculation
SELECT 'Step 6: Test unpaid leave calculation' as step;
SELECT 
  p.name,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2024-01-01'::DATE) as unpaid_days
FROM public.profiles p
WHERE p.is_active = true
ORDER BY p.name;

-- Step 7: Test complete leave deduction calculation
SELECT 'Step 7: Test complete leave deduction calculation' as step;
SELECT 
  p.name,
  es.base_salary,
  public.calculate_daily_salary_rate(p.user_id, '2024-01-01'::DATE) as daily_rate,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2024-01-01'::DATE) as unpaid_days,
  public.calculate_month_leave_deductions(p.user_id, '2024-01-01'::DATE) as deduction_calculation
FROM public.profiles p
JOIN public.employee_salaries es ON es.user_id = p.user_id
WHERE p.is_active = true
ORDER BY p.name;

-- Step 8: Test leave summary with policy information
SELECT 'Step 8: Test leave summary with policy' as step;
SELECT 
  p.name,
  public.get_employee_leave_summary_with_policy(p.user_id, '2024-01-01'::DATE) as leave_summary
FROM public.profiles p
WHERE p.is_active = true
ORDER BY p.name;

-- Step 9: Test leave request validation
SELECT 'Step 9: Test leave request validation' as step;
SELECT 
  p.name,
  lt.name as leave_type_name,
  public.validate_leave_request(
    p.user_id, 
    lt.id, 
    '2024-01-15'::DATE, 
    '2024-01-17'::DATE
  ) as validation_result
FROM public.profiles p
CROSS JOIN public.leave_types lt
WHERE p.is_active = true
  AND lt.is_active = true
LIMIT 5;

-- Step 10: Check for any unprocessed leave requests
SELECT 'Step 10: Check unprocessed leave requests' as step;
SELECT 
  p.name,
  lr.id,
  lr.start_date,
  lr.end_date,
  lr.status,
  lr.processed,
  lt.name as leave_type_name
FROM public.profiles p
JOIN public.leave_requests lr ON lr.user_id = p.user_id
JOIN public.leave_types lt ON lt.id = lr.leave_type_id
WHERE lr.status = 'approved' AND lr.processed = false;

-- Step 11: Process any remaining unprocessed leave requests
SELECT 'Step 11: Process remaining leave requests' as step;
SELECT public.populate_leaves_from_requests() as leaves_created;

-- Step 12: Update existing leaves with correct paid/unpaid status
SELECT 'Step 12: Update existing leaves status' as step;
SELECT public.update_leaves_paid_status() as leaves_updated;

-- Step 13: Final verification - check Arjan Singh specifically
SELECT 'Step 13: Final verification for Arjan Singh' as step;
SELECT 
  p.name,
  p.employee_category_id,
  ec.name as category_name,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2024-01-01'::DATE) as unpaid_days,
  public.calculate_month_leave_deductions(p.user_id, '2024-01-01'::DATE) as deduction_calculation,
  public.get_employee_leave_summary_with_policy(p.user_id, '2024-01-01'::DATE) as leave_summary
FROM public.profiles p
JOIN public.employee_categories ec ON ec.id = p.employee_category_id
WHERE p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%';

-- Step 14: Check all employees' final status
SELECT 'Step 14: Check all employees final status' as step;
SELECT 
  p.name,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2024-01-01'::DATE) as unpaid_days,
  public.calculate_month_leave_deductions(p.user_id, '2024-01-01'::DATE) as deduction_calculation
FROM public.profiles p
WHERE p.is_active = true
ORDER BY p.name;

