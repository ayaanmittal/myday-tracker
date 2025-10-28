-- Diagnose why salary data is showing all zeros
-- This will help identify the root cause

-- 1. Check if RPC functions exist
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'get_employee_salary_summary',
    'get_employee_leaves_with_salary_deductions', 
    'get_employee_salary_payment'
  )
ORDER BY routine_name;

-- 2. Check if employee_salaries table has data
SELECT 
  'employee_salaries' as table_name,
  COUNT(*) as record_count,
  COUNT(DISTINCT user_id) as unique_employees
FROM public.employee_salaries;

-- 3. Check if salary_payments table has data
SELECT 
  'salary_payments' as table_name,
  COUNT(*) as record_count,
  COUNT(DISTINCT user_id) as unique_employees
FROM public.salary_payments;

-- 4. Check if leaves table has data
SELECT 
  'leaves' as table_name,
  COUNT(*) as record_count,
  COUNT(DISTINCT user_id) as unique_employees
FROM public.leaves;

-- 5. Check if company_holidays table has data
SELECT 
  'company_holidays' as table_name,
  COUNT(*) as record_count
FROM public.company_holidays;

-- 6. Test the RPC function with a specific user
SELECT 
  'Testing get_employee_salary_summary' as test_name,
  *
FROM public.get_employee_salary_summary(
  (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1),
  '2025-10-01'
);

-- 7. Test the leaves function
SELECT 
  'Testing get_employee_leaves_with_salary_deductions' as test_name,
  COUNT(*) as leave_count
FROM public.get_employee_leaves_with_salary_deductions(
  (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1),
  '2025-10-01'
);

-- 8. Check if the user exists
SELECT 
  'User check' as test_name,
  id,
  email,
  full_name
FROM public.profiles 
WHERE email = 'sakshisaglotia@gmail.com';

