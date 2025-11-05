-- Quick test to verify data exists and RPC functions work
-- Run this to check if the issue is with data or functions

-- 1. Check if user exists
SELECT 
  'User check' as test_name,
  id,
  email,
  full_name
FROM public.profiles 
WHERE email = 'sakshisaglotia@gmail.com';

-- 2. Check if employee salary exists
SELECT 
  'Employee salary check' as test_name,
  user_id,
  base_salary,
  effective_from,
  is_active
FROM public.employee_salaries 
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1);

-- 3. Check if leaves exist
SELECT 
  'Leaves check' as test_name,
  COUNT(*) as leave_count,
  COUNT(*) FILTER (WHERE is_paid_leave = false) as unpaid_count,
  COUNT(*) FILTER (WHERE is_paid_leave = true) as paid_count
FROM public.leaves 
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1);

-- 4. Check if company holidays exist
SELECT 
  'Company holidays check' as test_name,
  COUNT(*) as holiday_count,
  string_agg(title, ', ') as holiday_titles
FROM public.company_holidays;

-- 5. Test the RPC function directly
SELECT 
  'RPC Test - get_employee_salary_summary' as test_name,
  total_deductions,
  total_paid_leaves,
  total_unpaid_leaves,
  total_office_holidays,
  base_salary,
  net_salary,
  deduction_percentage
FROM public.get_employee_salary_summary(
  (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1),
  '2025-10-01'
);

-- 6. Test the leaves function
SELECT 
  'RPC Test - get_employee_leaves_with_salary_deductions' as test_name,
  COUNT(*) as leave_count,
  SUM(deduction_amount) as total_deductions,
  COUNT(*) FILTER (WHERE is_office_holiday = true) as office_holiday_count
FROM public.get_employee_leaves_with_salary_deductions(
  (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1),
  '2025-10-01'
);

-- 7. If salary is still 0, insert it manually
INSERT INTO public.employee_salaries (user_id, profile_id, base_salary, effective_from, is_active) 
SELECT 
  p.id,
  p.id,
  50000.00,
  '2025-01-01',
  true
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT (user_id, effective_from) DO UPDATE SET
  base_salary = EXCLUDED.base_salary,
  is_active = EXCLUDED.is_active;

-- 8. Test again after inserting salary
SELECT 
  'Final RPC Test' as test_name,
  *
FROM public.get_employee_salary_summary(
  (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1),
  '2025-10-01'
);



