-- FIX ANALYTICS FUNCTIONS CORRECTED
-- This script fixes the analytics functions with correct schema references

-- Step 1: Check if analytics functions exist
SELECT 
  'Existing analytics functions' as info,
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%analytics%'
ORDER BY routine_name;

-- Step 2: Create or update get_payroll_analytics function
CREATE OR REPLACE FUNCTION public.get_payroll_analytics(
  p_start_month DATE DEFAULT (CURRENT_DATE - INTERVAL '12 months')::DATE,
  p_end_month DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  total_employees BIGINT,
  total_payroll_outflow NUMERIC(12,2),
  average_salary NUMERIC(12,2),
  highest_paid_employee TEXT,
  highest_salary NUMERIC(12,2),
  total_leave_deductions NUMERIC(12,2),
  average_deduction_percentage NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH payroll_summary AS (
    SELECT 
      COUNT(DISTINCT sp.user_id) as employee_count,
      COALESCE(SUM(sp.net_salary), 0) as total_payroll,
      COALESCE(AVG(sp.net_salary), 0) as avg_salary,
      COALESCE(SUM(sp.leave_deductions), 0) as total_deductions,
      COALESCE(AVG(sp.deduction_percentage), 0) as avg_deduction_pct
    FROM public.salary_payments sp
    WHERE sp.payment_month BETWEEN p_start_month AND p_end_month
  ),
  highest_paid AS (
    SELECT 
      p.name as employee_name,
      sp.net_salary
    FROM public.salary_payments sp
    JOIN public.profiles p ON p.user_id = sp.user_id
    WHERE sp.payment_month BETWEEN p_start_month AND p_end_month
    ORDER BY sp.net_salary DESC
    LIMIT 1
  )
  SELECT 
    COALESCE(ps.employee_count, 0),
    COALESCE(ps.total_payroll, 0),
    COALESCE(ps.avg_salary, 0),
    COALESCE(hp.employee_name, 'N/A'),
    COALESCE(hp.net_salary, 0),
    COALESCE(ps.total_deductions, 0),
    COALESCE(ps.avg_deduction_pct, 0)
  FROM payroll_summary ps
  LEFT JOIN highest_paid hp ON true;
END;
$$;

-- Step 3: Create function to get leave deductions analytics (CORRECTED)
CREATE OR REPLACE FUNCTION public.get_leave_deductions_analytics(
  p_start_month DATE DEFAULT (CURRENT_DATE - INTERVAL '12 months')::DATE,
  p_end_month DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  total_unpaid_leaves BIGINT,
  total_paid_leaves BIGINT,
  total_office_holidays BIGINT,
  total_deduction_amount NUMERIC(12,2),
  average_deduction_percentage NUMERIC(5,2),
  employees_with_deductions BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH leave_summary AS (
    SELECT 
      COUNT(*) FILTER (WHERE l.is_paid_leave = false AND l.is_approved = true) as unpaid_count,
      COUNT(*) FILTER (WHERE l.is_paid_leave = true AND l.is_approved = true) as paid_count,
      -- Count office holidays from company_holidays table (CORRECTED)
      (SELECT COUNT(*) FROM public.company_holidays ch 
       WHERE ch.holiday_date BETWEEN p_start_month AND p_end_month) as office_holiday_count,
      COUNT(DISTINCT l.user_id) FILTER (WHERE l.is_paid_leave = false AND l.is_approved = true) as employees_with_unpaid
    FROM public.leaves l
    WHERE l.leave_date BETWEEN p_start_month AND p_end_month
  ),
  deduction_summary AS (
    SELECT 
      COALESCE(SUM(sp.leave_deductions), 0) as total_deductions,
      COALESCE(AVG(sp.deduction_percentage), 0) as avg_deduction_pct
    FROM public.salary_payments sp
    WHERE sp.payment_month BETWEEN p_start_month AND p_end_month
  )
  SELECT 
    COALESCE(ls.unpaid_count, 0),
    COALESCE(ls.paid_count, 0),
    COALESCE(ls.office_holiday_count, 0),
    COALESCE(ds.total_deductions, 0),
    COALESCE(ds.avg_deduction_pct, 0),
    COALESCE(ls.employees_with_unpaid, 0)
  FROM leave_summary ls
  CROSS JOIN deduction_summary ds;
END;
$$;

-- Step 4: Create function to get monthly salary summary
CREATE OR REPLACE FUNCTION public.get_monthly_salary_summary(
  p_month DATE
)
RETURNS TABLE(
  total_employees BIGINT,
  total_base_salary NUMERIC(12,2),
  total_net_salary NUMERIC(12,2),
  total_deductions NUMERIC(12,2),
  average_salary NUMERIC(12,2),
  employees_with_deductions BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT sp.user_id) as total_employees,
    COALESCE(SUM(sp.base_salary), 0) as total_base_salary,
    COALESCE(SUM(sp.net_salary), 0) as total_net_salary,
    COALESCE(SUM(sp.leave_deductions), 0) as total_deductions,
    COALESCE(AVG(sp.net_salary), 0) as average_salary,
    COUNT(DISTINCT sp.user_id) FILTER (WHERE sp.leave_deductions > 0) as employees_with_deductions
  FROM public.salary_payments sp
  WHERE sp.payment_month = p_month;
END;
$$;

-- Step 5: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_payroll_analytics(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leave_deductions_analytics(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_salary_summary(DATE) TO authenticated;

-- Step 6: Test the analytics functions
SELECT 
  'Testing get_payroll_analytics' as test_step,
  *
FROM public.get_payroll_analytics(
  (CURRENT_DATE - INTERVAL '12 months')::DATE,
  CURRENT_DATE::DATE
);

-- Step 7: Test leave deductions analytics
SELECT 
  'Testing get_leave_deductions_analytics' as test_step,
  *
FROM public.get_leave_deductions_analytics(
  (CURRENT_DATE - INTERVAL '12 months')::DATE,
  CURRENT_DATE::DATE
);

-- Step 8: Test monthly salary summary for current month
SELECT 
  'Testing get_monthly_salary_summary' as test_step,
  *
FROM public.get_monthly_salary_summary(CURRENT_DATE::DATE);

-- Step 9: Check if we have any salary payments data
SELECT 
  'Salary payments data check' as test_step,
  COUNT(*) as total_payments,
  COUNT(DISTINCT user_id) as unique_employees,
  MIN(payment_month) as earliest_month,
  MAX(payment_month) as latest_month
FROM public.salary_payments;

-- Step 10: Check if we have any leaves data (CORRECTED)
SELECT 
  'Leaves data check' as test_step,
  COUNT(*) as total_leaves,
  COUNT(DISTINCT user_id) as unique_employees,
  COUNT(*) FILTER (WHERE is_paid_leave = false AND is_approved = true) as unpaid_leaves,
  COUNT(*) FILTER (WHERE is_paid_leave = true AND is_approved = true) as paid_leaves
FROM public.leaves;

-- Step 11: Check company holidays data
SELECT 
  'Company holidays data check' as test_step,
  COUNT(*) as total_holidays,
  MIN(holiday_date) as earliest_holiday,
  MAX(holiday_date) as latest_holiday
FROM public.company_holidays;



