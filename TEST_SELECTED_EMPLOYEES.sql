-- TEST SELECTED EMPLOYEES FUNCTIONALITY
-- This script tests the generate_monthly_salary_payments function with selected employees

-- Step 1: Get some employee IDs for testing
SELECT 
  'Available employees' as test_step,
  p.user_id,
  p.name,
  es.base_salary
FROM public.profiles p
JOIN public.employee_salaries es ON es.profile_id = p.id
WHERE p.is_active = true
  AND es.is_active = true
  AND es.effective_from <= '2025-10-01'
  AND (es.effective_to IS NULL OR es.effective_to >= '2025-10-01')
ORDER BY p.name;

-- Step 2: Test with specific selected employees (Dolly Jhamb and Isha Sharma)
SELECT 
  'Testing with selected employees (Dolly Jhamb and Isha Sharma)' as test_step,
  COUNT(*) as generated_payments
FROM public.generate_monthly_salary_payments(
  '2025-10-01'::DATE, 
  NULL, 
  ARRAY[
    (SELECT id FROM public.profiles WHERE name = 'Dolly Jhamb' LIMIT 1),
    (SELECT id FROM public.profiles WHERE name = 'Isha Sharma' LIMIT 1)
  ]::UUID[]
);

-- Step 3: Check the results for selected employees only
SELECT 
  'Generated salary payments for selected employees' as test_step,
  sp.user_id,
  p.name,
  sp.base_salary,
  sp.net_salary,
  sp.leave_deductions,
  sp.unpaid_leave_days,
  sp.created_at
FROM public.salary_payments sp
JOIN public.profiles p ON p.user_id = sp.user_id
WHERE sp.payment_month = '2025-10-01'
  AND p.name IN ('Dolly Jhamb', 'Isha Sharma')
ORDER BY p.name;

-- Step 4: Verify that other employees were NOT processed
SELECT 
  'Other employees should not have payments' as test_step,
  COUNT(*) as other_employee_payments
FROM public.salary_payments sp
JOIN public.profiles p ON p.user_id = sp.user_id
WHERE sp.payment_month = '2025-10-01'
  AND p.name NOT IN ('Dolly Jhamb', 'Isha Sharma');

-- Step 5: Test with NULL selected employees (should process all)
SELECT 
  'Testing with NULL selected employees (should process all)' as test_step,
  COUNT(*) as generated_payments
FROM public.generate_monthly_salary_payments('2025-10-01'::DATE, NULL, NULL);

-- Step 6: Check total payments after processing all
SELECT 
  'Total salary payments after processing all' as test_step,
  COUNT(*) as total_payments,
  COUNT(DISTINCT sp.user_id) as unique_employees
FROM public.salary_payments sp
WHERE sp.payment_month = '2025-10-01';
