-- Test the salary data fix
-- This will verify that all components are working

-- 1. Test the RPC function directly
SELECT 
  'Testing get_employee_salary_summary' as test_name,
  *
FROM public.get_employee_salary_summary(
  (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1),
  '2025-10-01'
);

-- 2. Test the leaves function
SELECT 
  'Testing get_employee_leaves_with_salary_deductions' as test_name,
  COUNT(*) as leave_count,
  SUM(deduction_amount) as total_deductions
FROM public.get_employee_leaves_with_salary_deductions(
  (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1),
  '2025-10-01'
);

-- 3. Check if employee salary exists
SELECT 
  'Employee salary check' as test_name,
  base_salary,
  effective_from,
  is_active
FROM public.employee_salaries 
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1);

-- 4. Check if leaves exist
SELECT 
  'Leaves check' as test_name,
  COUNT(*) as leave_count,
  COUNT(*) FILTER (WHERE is_paid_leave = false) as unpaid_count,
  COUNT(*) FILTER (WHERE is_paid_leave = true) as paid_count
FROM public.leaves 
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1);

-- 5. Check if company holidays exist
SELECT 
  'Company holidays check' as test_name,
  COUNT(*) as holiday_count,
  string_agg(title, ', ') as holiday_titles
FROM public.company_holidays;
