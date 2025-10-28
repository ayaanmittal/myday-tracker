-- TEST SALARY FUNCTIONS SIMPLE
-- This script tests the salary functions step by step

-- Step 1: Test if calculate_month_leave_deductions function exists
SELECT 
  'Function exists check' as test_step,
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'calculate_month_leave_deductions';

-- Step 2: Test calculate_month_leave_deductions for a specific employee
SELECT 
  'Testing calculate_month_leave_deductions' as test_step,
  'Dolly Jhamb' as employee_name,
  *
FROM public.calculate_month_leave_deductions(
  (SELECT id FROM public.profiles WHERE name = 'Dolly Jhamb' LIMIT 1),
  '2025-10-01'::DATE
);

-- Step 3: Test generate_monthly_salary_payments function
SELECT 
  'Testing generate_monthly_salary_payments' as test_step,
  COUNT(*) as result_count
FROM public.generate_monthly_salary_payments('2025-10-01'::DATE);

-- Step 4: Check the generated salary payments
SELECT 
  'Generated salary payments' as test_step,
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
ORDER BY p.name;

