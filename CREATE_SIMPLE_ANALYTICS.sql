-- CREATE SIMPLE ANALYTICS
-- This script creates simple analytics functions that always return data

-- Step 1: Create a simple payroll analytics function that handles empty data
CREATE OR REPLACE FUNCTION public.get_simple_payroll_analytics(
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
  WITH payroll_data AS (
    SELECT 
      COUNT(DISTINCT sp.user_id) as employee_count,
      COALESCE(SUM(sp.net_salary), 0) as total_payroll,
      COALESCE(AVG(sp.net_salary), 0) as avg_salary,
      COALESCE(SUM(sp.leave_deductions), 0) as total_deductions,
      COALESCE(AVG(sp.deduction_percentage), 0) as avg_deduction_pct
    FROM public.salary_payments sp
    WHERE sp.payment_month BETWEEN p_start_month AND p_end_month
  ),
  highest_paid_data AS (
    SELECT 
      p.name as employee_name,
      sp.net_salary
    FROM public.salary_payments sp
    JOIN public.profiles p ON p.user_id = sp.user_id
    WHERE sp.payment_month BETWEEN p_start_month AND p_end_month
    ORDER BY sp.net_salary DESC
    LIMIT 1
  ),
  fallback_data AS (
    SELECT 
      COUNT(DISTINCT es.user_id) as employee_count,
      COALESCE(SUM(es.base_salary), 0) as total_payroll,
      COALESCE(AVG(es.base_salary), 0) as avg_salary,
      0 as total_deductions,
      0 as avg_deduction_pct
    FROM public.employee_salaries es
    JOIN public.profiles p ON p.id = es.profile_id
    WHERE es.is_active = true
      AND p.is_active = true
      AND es.effective_from <= p_end_month
      AND (es.effective_to IS NULL OR es.effective_to >= p_start_month)
  )
  SELECT 
    CASE 
      WHEN pd.employee_count > 0 THEN pd.employee_count
      ELSE fd.employee_count
    END,
    CASE 
      WHEN pd.total_payroll > 0 THEN pd.total_payroll
      ELSE fd.total_payroll
    END,
    CASE 
      WHEN pd.avg_salary > 0 THEN pd.avg_salary
      ELSE fd.avg_salary
    END,
    COALESCE(hpd.employee_name, 'No data available'),
    COALESCE(hpd.net_salary, 0),
    COALESCE(pd.total_deductions, 0),
    COALESCE(pd.avg_deduction_pct, 0)
  FROM payroll_data pd
  CROSS JOIN fallback_data fd
  LEFT JOIN highest_paid_data hpd ON true;
END;
$$;

-- Step 2: Create a simple leave deductions analytics function
CREATE OR REPLACE FUNCTION public.get_simple_leave_deductions_analytics(
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
  WITH leave_data AS (
    SELECT 
      COUNT(*) FILTER (WHERE l.is_paid_leave = false AND l.is_approved = true) as unpaid_count,
      COUNT(*) FILTER (WHERE l.is_paid_leave = true AND l.is_approved = true) as paid_count,
      COUNT(DISTINCT l.user_id) FILTER (WHERE l.is_paid_leave = false AND l.is_approved = true) as employees_with_unpaid
    FROM public.leaves l
    WHERE l.leave_date BETWEEN p_start_month AND p_end_month
  ),
  holiday_data AS (
    SELECT COUNT(*) as office_holiday_count
    FROM public.company_holidays ch
    WHERE ch.holiday_date BETWEEN p_start_month AND p_end_month
  ),
  deduction_data AS (
    SELECT 
      COALESCE(SUM(sp.leave_deductions), 0) as total_deductions,
      COALESCE(AVG(sp.deduction_percentage), 0) as avg_deduction_pct,
      COUNT(DISTINCT sp.user_id) FILTER (WHERE sp.leave_deductions > 0) as employees_with_deductions
    FROM public.salary_payments sp
    WHERE sp.payment_month BETWEEN p_start_month AND p_end_month
  )
  SELECT 
    COALESCE(ld.unpaid_count, 0),
    COALESCE(ld.paid_count, 0),
    COALESCE(hd.office_holiday_count, 0),
    COALESCE(dd.total_deductions, 0),
    COALESCE(dd.avg_deduction_pct, 0),
    COALESCE(dd.employees_with_deductions, 0)
  FROM leave_data ld
  CROSS JOIN holiday_data hd
  CROSS JOIN deduction_data dd;
END;
$$;

-- Step 3: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_simple_payroll_analytics(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_simple_leave_deductions_analytics(DATE, DATE) TO authenticated;

-- Step 4: Test the simple analytics functions
SELECT 
  'Testing get_simple_payroll_analytics' as test_step,
  *
FROM public.get_simple_payroll_analytics(
  (CURRENT_DATE - INTERVAL '12 months')::DATE,
  CURRENT_DATE::DATE
);

-- Step 5: Test leave deductions analytics
SELECT 
  'Testing get_simple_leave_deductions_analytics' as test_step,
  *
FROM public.get_simple_leave_deductions_analytics(
  (CURRENT_DATE - INTERVAL '12 months')::DATE,
  CURRENT_DATE::DATE
);

-- Step 6: Test with October 2025
SELECT 
  'Testing get_simple_payroll_analytics for October 2025' as test_step,
  *
FROM public.get_simple_payroll_analytics('2025-10-01'::DATE, '2025-10-31'::DATE);

-- Step 7: Test leave deductions for October 2025
SELECT 
  'Testing get_simple_leave_deductions_analytics for October 2025' as test_step,
  *
FROM public.get_simple_leave_deductions_analytics('2025-10-01'::DATE, '2025-10-31'::DATE);
