-- Create RPC functions for My Leaves & Salary functionality
-- These functions provide the data that the frontend needs

-- 1. Function to get employee leaves with salary deductions
CREATE OR REPLACE FUNCTION public.get_employee_leaves_with_salary_deductions(
  p_user_id UUID,
  p_month DATE
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  leave_date DATE,
  leave_type_name TEXT,
  is_paid_leave BOOLEAN,
  is_approved BOOLEAN,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  daily_rate DECIMAL(10,2),
  deduction_amount DECIMAL(10,2),
  is_office_holiday BOOLEAN,
  deduction_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_salary DECIMAL(10,2);
  v_daily_rate DECIMAL(10,2);
  v_month_start DATE;
  v_month_end DATE;
BEGIN
  -- Get the month boundaries
  v_month_start := DATE_TRUNC('month', p_month)::DATE;
  v_month_end := (DATE_TRUNC('month', p_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Get employee's base salary for the month
  SELECT es.base_salary INTO v_base_salary
  FROM public.employee_salaries es
  WHERE es.user_id = p_user_id
    AND es.is_active = true
    AND es.effective_from <= v_month_end
    AND (es.effective_to IS NULL OR es.effective_to >= v_month_start)
  ORDER BY es.effective_from DESC
  LIMIT 1;
  
  -- Calculate daily rate (base salary / days in month)
  v_daily_rate := COALESCE(v_base_salary / EXTRACT(DAY FROM v_month_end), 0);
  
  -- Return leaves with salary deduction information
  RETURN QUERY
  SELECT 
    l.id,
    l.user_id,
    l.leave_date,
    COALESCE(lt.name, 'Personal Leave') as leave_type_name,
    l.is_paid_leave,
    l.is_approved,
    l.approved_by,
    l.approved_at,
    l.created_at,
    l.notes,
    v_daily_rate as daily_rate,
    CASE 
      WHEN l.is_paid_leave = false AND l.is_approved = true THEN v_daily_rate
      ELSE 0
    END as deduction_amount,
    false as is_office_holiday,
    CASE 
      WHEN l.is_paid_leave = false AND l.is_approved = true THEN 'Unpaid leave deduction'
      ELSE 'No deduction'
    END as deduction_reason
  FROM public.leaves l
  LEFT JOIN public.leave_types lt ON l.leave_type_id = lt.id
  WHERE l.user_id = p_user_id
    AND l.leave_date >= v_month_start
    AND l.leave_date <= v_month_end
  ORDER BY l.leave_date;
END;
$$;

-- 2. Function to get employee salary summary
CREATE OR REPLACE FUNCTION public.get_employee_salary_summary(
  p_user_id UUID,
  p_month DATE
)
RETURNS TABLE(
  total_deductions DECIMAL(10,2),
  total_paid_leaves INTEGER,
  total_unpaid_leaves INTEGER,
  total_office_holidays INTEGER,
  base_salary DECIMAL(10,2),
  net_salary DECIMAL(10,2),
  deduction_percentage DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_salary DECIMAL(10,2) := 0;
  v_daily_rate DECIMAL(10,2) := 0;
  v_month_start DATE;
  v_month_end DATE;
  v_total_deductions DECIMAL(10,2) := 0;
  v_paid_leaves INTEGER := 0;
  v_unpaid_leaves INTEGER := 0;
  v_office_holidays INTEGER := 0;
  v_net_salary DECIMAL(10,2) := 0;
  v_deduction_percentage DECIMAL(5,2) := 0;
BEGIN
  -- Get the month boundaries
  v_month_start := DATE_TRUNC('month', p_month)::DATE;
  v_month_end := (DATE_TRUNC('month', p_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Get employee's base salary for the month
  SELECT es.base_salary INTO v_base_salary
  FROM public.employee_salaries es
  WHERE es.user_id = p_user_id
    AND es.is_active = true
    AND es.effective_from <= v_month_end
    AND (es.effective_to IS NULL OR es.effective_to >= v_month_start)
  ORDER BY es.effective_from DESC
  LIMIT 1;
  
  -- Calculate daily rate
  v_daily_rate := COALESCE(v_base_salary / EXTRACT(DAY FROM v_month_end), 0);
  
  -- Count leaves and calculate deductions
  SELECT 
    COUNT(*) FILTER (WHERE l.is_paid_leave = true AND l.is_approved = true),
    COUNT(*) FILTER (WHERE l.is_paid_leave = false AND l.is_approved = true),
    SUM(CASE WHEN l.is_paid_leave = false AND l.is_approved = true THEN v_daily_rate ELSE 0 END)
  INTO v_paid_leaves, v_unpaid_leaves, v_total_deductions
  FROM public.leaves l
  WHERE l.user_id = p_user_id
    AND l.leave_date >= v_month_start
    AND l.leave_date <= v_month_end;
  
  -- Count office holidays
  SELECT COUNT(*)
  INTO v_office_holidays
  FROM public.company_holidays ch
  WHERE ch.holiday_date >= v_month_start
    AND ch.holiday_date <= v_month_end
    AND ch.is_office_holiday = true;
  
  -- Calculate net salary and deduction percentage
  v_net_salary := v_base_salary - COALESCE(v_total_deductions, 0);
  v_deduction_percentage := CASE 
    WHEN v_base_salary > 0 THEN (COALESCE(v_total_deductions, 0) / v_base_salary * 100)
    ELSE 0
  END;
  
  -- Return the summary
  RETURN QUERY
  SELECT 
    COALESCE(v_total_deductions, 0),
    COALESCE(v_paid_leaves, 0),
    COALESCE(v_unpaid_leaves, 0),
    COALESCE(v_office_holidays, 0),
    COALESCE(v_base_salary, 0),
    COALESCE(v_net_salary, 0),
    COALESCE(v_deduction_percentage, 0);
END;
$$;

-- 3. Function to get employee work days for a month
CREATE OR REPLACE FUNCTION public.get_employee_work_days(
  p_user_id UUID,
  p_month DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month_start DATE;
  v_month_end DATE;
  v_total_days INTEGER;
  v_sundays INTEGER;
  v_office_holidays INTEGER;
  v_work_days INTEGER;
BEGIN
  -- Get the month boundaries
  v_month_start := DATE_TRUNC('month', p_month)::DATE;
  v_month_end := (DATE_TRUNC('month', p_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Calculate total days in month
  v_total_days := EXTRACT(DAY FROM v_month_end);
  
  -- Count Sundays in the month
  SELECT COUNT(*)
  INTO v_sundays
  FROM generate_series(v_month_start, v_month_end, '1 day'::interval) as day
  WHERE EXTRACT(DOW FROM day) = 0;
  
  -- Count office holidays
  SELECT COUNT(*)
  INTO v_office_holidays
  FROM public.company_holidays ch
  WHERE ch.holiday_date >= v_month_start
    AND ch.holiday_date <= v_month_end
    AND ch.is_office_holiday = true;
  
  -- Calculate work days (total days - Sundays - office holidays)
  v_work_days := v_total_days - v_sundays - v_office_holidays;
  
  RETURN GREATEST(v_work_days, 0);
END;
$$;

-- 4. Function to get employee salary payment for a month
CREATE OR REPLACE FUNCTION public.get_employee_salary_payment(
  p_user_id UUID,
  p_month DATE
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  profile_id UUID,
  payment_month DATE,
  base_salary DECIMAL(10,2),
  gross_salary DECIMAL(10,2),
  deductions DECIMAL(10,2),
  net_salary DECIMAL(10,2),
  leave_deductions DECIMAL(10,2),
  unpaid_leave_days INTEGER,
  deduction_percentage DECIMAL(5,2),
  is_paid BOOLEAN,
  payment_date DATE,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(100),
  notes TEXT,
  processed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id,
    sp.user_id,
    sp.profile_id,
    sp.payment_month,
    sp.base_salary,
    sp.gross_salary,
    sp.deductions,
    sp.net_salary,
    sp.leave_deductions,
    sp.unpaid_leave_days,
    sp.deduction_percentage,
    sp.is_paid,
    sp.payment_date,
    sp.payment_method,
    sp.payment_reference,
    sp.notes,
    sp.processed_by,
    sp.created_at,
    sp.updated_at
  FROM public.salary_payments sp
  WHERE sp.user_id = p_user_id
    AND sp.payment_month = DATE_TRUNC('month', p_month)::DATE
  ORDER BY sp.created_at DESC;
END;
$$;

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_employee_leaves_with_salary_deductions(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_salary_summary(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_work_days(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_salary_payment(UUID, DATE) TO authenticated;

