-- Test script for the new leaves tracking system
-- This script tests the leaves system and fixes Arjan Singh's calculation

-- Step 1: Check if Arjan Singh has any leaves in the new system
SELECT 'Step 1: Check Arjan Singh leaves' as step;
SELECT 
  p.name,
  l.leave_date,
  l.leave_type_name,
  l.is_paid_leave,
  l.is_approved,
  l.notes
FROM public.profiles p
LEFT JOIN public.leaves l ON l.user_id = p.user_id
WHERE p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%'
ORDER BY l.leave_date;

-- Step 2: Check Arjan Singh's leave requests
SELECT 'Step 2: Check Arjan Singh leave requests' as step;
SELECT 
  p.name,
  lr.start_date,
  lr.end_date,
  lr.days_requested,
  lr.status,
  lt.name as leave_type_name,
  lt.is_paid as is_paid_leave
FROM public.profiles p
LEFT JOIN public.leave_requests lr ON lr.user_id = p.user_id
LEFT JOIN public.leave_types lt ON lt.id = lr.leave_type_id
WHERE p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%'
ORDER BY lr.start_date;

-- Step 3: Test the new unpaid leave calculation function
SELECT 'Step 3: Test unpaid leave calculation' as step;
SELECT 
  p.name,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2024-01-01'::DATE) as unpaid_days
FROM public.profiles p
WHERE p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%';

-- Step 4: Test the updated leave deduction calculation
SELECT 'Step 4: Test leave deduction calculation' as step;
SELECT * FROM public.calculate_month_leave_deductions(
  (SELECT user_id FROM public.profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1),
  '2024-01-01'::DATE
);

-- Step 5: Test the leave summary function
SELECT 'Step 5: Test leave summary' as step;
SELECT * FROM public.get_employee_leave_summary(
  (SELECT user_id FROM public.profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1),
  '2024-01-01'::DATE
);

-- Step 6: Check if there are any approved leave requests that need to be processed
SELECT 'Step 6: Check unprocessed leave requests' as step;
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

-- Step 7: Process any unprocessed leave requests
SELECT 'Step 7: Process leave requests' as step;
SELECT public.populate_leaves_from_requests() as leaves_created;

-- Step 8: Test the calculation again after processing
SELECT 'Step 8: Test calculation after processing' as step;
SELECT 
  p.name,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2024-01-01'::DATE) as unpaid_days
FROM public.profiles p
WHERE p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%';

-- Step 9: Test the complete leave deduction calculation
SELECT 'Step 9: Test complete leave deduction calculation' as step;
SELECT * FROM public.calculate_month_leave_deductions(
  (SELECT user_id FROM public.profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1),
  '2024-01-01'::DATE
);

-- Step 10: Check all employees' leave status
SELECT 'Step 10: Check all employees leave status' as step;
SELECT 
  p.name,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2024-01-01'::DATE) as unpaid_days,
  public.get_employee_leave_summary(p.user_id, '2024-01-01'::DATE) as leave_summary
FROM public.profiles p
WHERE p.is_active = true
ORDER BY p.name;

-- Step 11: Manual test - add a test unpaid leave for Arjan Singh (if needed)
-- Uncomment the following lines to add a test unpaid leave
/*
SELECT 'Step 11: Add test unpaid leave for Arjan Singh' as step;
SELECT public.add_manual_leave(
  (SELECT user_id FROM public.profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1),
  '2024-01-15'::DATE,
  'Unpaid Leave',
  false,  -- is_paid_leave = false
  'Test unpaid leave for salary calculation',
  NULL
) as leave_id;
*/

-- Step 12: Final verification
SELECT 'Step 12: Final verification' as step;
SELECT 
  p.name,
  es.base_salary,
  public.calculate_daily_salary_rate(p.user_id, '2024-01-01'::DATE) as daily_rate,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2024-01-01'::DATE) as unpaid_days,
  public.calculate_month_leave_deductions(p.user_id, '2024-01-01'::DATE) as deduction_calculation
FROM public.profiles p
JOIN public.employee_salaries es ON es.user_id = p.user_id
WHERE p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%';
