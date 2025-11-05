-- DIAGNOSE ANALYTICS ISSUE
-- This script diagnoses why analytics are showing "No analytics data available"

-- Step 1: Check if analytics functions exist
SELECT 
  'Analytics functions check' as diagnostic_step,
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_payroll_analytics', 'get_leave_deductions_analytics', 'get_monthly_salary_summary')
ORDER BY routine_name;

-- Step 2: Check salary_payments table data
SELECT 
  'Salary payments data check' as diagnostic_step,
  COUNT(*) as total_payments,
  COUNT(DISTINCT user_id) as unique_employees,
  MIN(payment_month) as earliest_month,
  MAX(payment_month) as latest_month,
  SUM(net_salary) as total_net_salary,
  SUM(leave_deductions) as total_leave_deductions
FROM public.salary_payments;

-- Step 3: Check leaves table data
SELECT 
  'Leaves data check' as diagnostic_step,
  COUNT(*) as total_leaves,
  COUNT(DISTINCT user_id) as unique_employees,
  COUNT(*) FILTER (WHERE is_paid_leave = false AND is_approved = true) as unpaid_leaves,
  COUNT(*) FILTER (WHERE is_paid_leave = true AND is_approved = true) as paid_leaves
FROM public.leaves;

-- Step 4: Check company_holidays table data
SELECT 
  'Company holidays data check' as diagnostic_step,
  COUNT(*) as total_holidays,
  MIN(holiday_date) as earliest_holiday,
  MAX(holiday_date) as latest_holiday
FROM public.company_holidays;

-- Step 5: Check employee_salaries table data
SELECT 
  'Employee salaries data check' as diagnostic_step,
  COUNT(*) as total_salaries,
  COUNT(DISTINCT user_id) as unique_employees,
  SUM(base_salary) as total_base_salary,
  AVG(base_salary) as avg_base_salary
FROM public.employee_salaries
WHERE is_active = true;

-- Step 6: Test get_payroll_analytics function
SELECT 
  'Testing get_payroll_analytics' as diagnostic_step,
  *
FROM public.get_payroll_analytics(
  (CURRENT_DATE - INTERVAL '12 months')::DATE,
  CURRENT_DATE::DATE
);

-- Step 7: Test get_leave_deductions_analytics function
SELECT 
  'Testing get_leave_deductions_analytics' as diagnostic_step,
  *
FROM public.get_leave_deductions_analytics(
  (CURRENT_DATE - INTERVAL '12 months')::DATE,
  CURRENT_DATE::DATE
);

-- Step 8: Test get_monthly_salary_summary for current month
SELECT 
  'Testing get_monthly_salary_summary for current month' as diagnostic_step,
  *
FROM public.get_monthly_salary_summary(CURRENT_DATE::DATE);

-- Step 9: Test get_monthly_salary_summary for October 2025
SELECT 
  'Testing get_monthly_salary_summary for October 2025' as diagnostic_step,
  *
FROM public.get_monthly_salary_summary('2025-10-01'::DATE);

-- Step 10: Show sample salary payments data
SELECT 
  'Sample salary payments' as diagnostic_step,
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
ORDER BY sp.created_at DESC
LIMIT 5;

-- Step 11: Check if we have any active employees with salaries
SELECT 
  'Active employees with salaries' as diagnostic_step,
  p.name,
  p.user_id,
  es.base_salary,
  es.effective_from,
  es.is_active
FROM public.profiles p
JOIN public.employee_salaries es ON es.profile_id = p.id
WHERE p.is_active = true
  AND es.is_active = true
ORDER BY p.name;



