-- CLEANUP SALARY PAYMENTS
-- This script cleans up existing salary payments and recreates them properly

-- Step 1: Check existing salary payments
SELECT 
  'Current salary payments' as info,
  COUNT(*) as total_payments,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(payment_month) as earliest_month,
  MAX(payment_month) as latest_month
FROM public.salary_payments;

-- Step 2: Check for duplicates
SELECT 
  'Duplicate payments' as info,
  user_id,
  payment_month,
  COUNT(*) as duplicate_count
FROM public.salary_payments
GROUP BY user_id, payment_month
HAVING COUNT(*) > 1;

-- Step 3: Clean up existing October 2025 payments (if any)
DELETE FROM public.salary_payments 
WHERE payment_month = '2025-10-01';

-- Step 4: Check what employees have salaries configured
SELECT 
  'Employees with salaries' as info,
  p.name,
  p.user_id,
  es.base_salary,
  es.effective_from,
  es.is_active
FROM public.profiles p
JOIN public.employee_salaries es ON es.profile_id = p.id
WHERE p.is_active = true
  AND es.is_active = true
  AND es.effective_from <= '2025-10-01'
  AND (es.effective_to IS NULL OR es.effective_to >= '2025-10-01')
ORDER BY p.name;

-- Step 5: Test the calculate_month_leave_deductions function for each employee
SELECT 
  'Testing leave deductions for each employee' as info,
  p.name,
  p.user_id,
  ld.total_unpaid_days,
  ld.total_deduction_amount,
  ld.daily_rate
FROM public.profiles p
JOIN public.employee_salaries es ON es.profile_id = p.id
CROSS JOIN LATERAL calculate_month_leave_deductions(p.user_id, '2025-10-01'::DATE) ld
WHERE p.is_active = true
  AND es.is_active = true
  AND es.effective_from <= '2025-10-01'
  AND (es.effective_to IS NULL OR es.effective_to >= '2025-10-01')
ORDER BY p.name;

-- Step 6: Now test the generate function
SELECT 
  'Testing generate_monthly_salary_payments' as info,
  *
FROM public.generate_monthly_salary_payments('2025-10-01'::DATE);

-- Step 7: Check the final results
SELECT 
  'Final salary payments' as info,
  sp.user_id,
  p.name,
  sp.payment_month,
  sp.base_salary,
  sp.net_salary,
  sp.leave_deductions,
  sp.unpaid_leave_days,
  sp.created_at
FROM public.salary_payments sp
JOIN public.profiles p ON p.user_id = sp.user_id
WHERE sp.payment_month = '2025-10-01'
ORDER BY p.name;
