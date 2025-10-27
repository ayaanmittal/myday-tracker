-- Fix office holidays logic to properly handle holidays within leave periods
-- This script updates the RPC functions to accurately count office holidays
-- and subtract them from unpaid leave days when they overlap

-- 1. Updated function to get employee salary summary with proper office holiday handling
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
  v_unpaid_leave_days INTEGER := 0;
  v_office_holidays_in_leaves INTEGER := 0;
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
  
  -- Count total office holidays in the month (including Sundays)
  WITH all_holidays AS (
    -- Company holidays
    SELECT ch.holiday_date as holiday_date
    FROM public.company_holidays ch
    WHERE ch.holiday_date >= v_month_start
      AND ch.holiday_date <= v_month_end
    
    UNION
    
    -- Sundays
    SELECT generate_series(v_month_start, v_month_end, '1 day'::interval)::date as holiday_date
    WHERE EXTRACT(DOW FROM generate_series(v_month_start, v_month_end, '1 day'::interval)) = 0
  )
  SELECT COUNT(DISTINCT holiday_date)
  INTO v_office_holidays
  FROM all_holidays;
  
  -- Count paid leaves
  SELECT COUNT(*)
  INTO v_paid_leaves
  FROM public.leaves l
  WHERE l.user_id = p_user_id
    AND l.leave_date >= v_month_start
    AND l.leave_date <= v_month_end
    AND l.is_paid_leave = true 
    AND l.is_approved = true;
  
  -- Count unpaid leave days (excluding office holidays and Sundays)
  SELECT COUNT(*)
  INTO v_unpaid_leave_days
  FROM public.leaves l
  WHERE l.user_id = p_user_id
    AND l.leave_date >= v_month_start
    AND l.leave_date <= v_month_end
    AND l.is_paid_leave = false 
    AND l.is_approved = true
    AND NOT EXISTS (
      SELECT 1 FROM public.company_holidays ch 
      WHERE ch.holiday_date = l.leave_date
    )
    AND EXTRACT(DOW FROM l.leave_date) != 0; -- Exclude Sundays
  
  -- Count office holidays and Sundays that fall within unpaid leave periods
  WITH all_holidays AS (
    -- Company holidays
    SELECT ch.holiday_date as holiday_date
    FROM public.company_holidays ch
    WHERE ch.holiday_date >= v_month_start
      AND ch.holiday_date <= v_month_end
    
    UNION
    
    -- Sundays
    SELECT generate_series(v_month_start, v_month_end, '1 day'::interval)::date as holiday_date
    WHERE EXTRACT(DOW FROM generate_series(v_month_start, v_month_end, '1 day'::interval)) = 0
  )
  SELECT COUNT(*)
  INTO v_office_holidays_in_leaves
  FROM all_holidays ah
  WHERE EXISTS (
    SELECT 1 FROM public.leaves l 
    WHERE l.user_id = p_user_id
      AND l.leave_date = ah.holiday_date
      AND l.is_paid_leave = false 
      AND l.is_approved = true
  );
  
  -- Calculate total deductions (only for unpaid leave days that are not office holidays)
  v_total_deductions := v_unpaid_leave_days * v_daily_rate;
  
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
    COALESCE(v_unpaid_leave_days, 0),
    COALESCE(v_office_holidays, 0),
    COALESCE(v_base_salary, 0),
    COALESCE(v_net_salary, 0),
    COALESCE(v_deduction_percentage, 0);
END;
$$;

-- 2. Updated function to get employee leaves with proper office holiday detection
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
    COALESCE(l.leave_type_name, 'Personal Leave') as leave_type_name,
    l.is_paid_leave,
    l.is_approved,
    l.approved_by,
    l.approved_at,
    l.created_at,
    l.notes,
    v_daily_rate as daily_rate,
    CASE 
      WHEN l.is_paid_leave = false AND l.is_approved = true 
        AND NOT EXISTS (
          SELECT 1 FROM public.company_holidays ch 
          WHERE ch.holiday_date = l.leave_date
        )
        AND EXTRACT(DOW FROM l.leave_date) != 0 THEN v_daily_rate
      ELSE 0
    END as deduction_amount,
    (EXISTS (
      SELECT 1 FROM public.company_holidays ch 
      WHERE ch.holiday_date = l.leave_date
    ) OR EXTRACT(DOW FROM l.leave_date) = 0) as is_office_holiday,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.company_holidays ch 
        WHERE ch.holiday_date = l.leave_date
      ) THEN COALESCE(
        (SELECT 'Office holiday - ' || ch.title || ' - no deduction' 
         FROM public.company_holidays ch 
         WHERE ch.holiday_date = l.leave_date 
         LIMIT 1),
        'Office holiday - no deduction'
      )
      WHEN EXTRACT(DOW FROM l.leave_date) = 0 THEN 'Sunday - no deduction'
      WHEN l.is_paid_leave = false AND l.is_approved = true THEN 'Unpaid leave deduction'
      ELSE 'No deduction'
    END as deduction_reason
  FROM public.leaves l
  WHERE l.user_id = p_user_id
    AND l.leave_date >= v_month_start
    AND l.leave_date <= v_month_end
  ORDER BY l.leave_date;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_employee_salary_summary(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_leaves_with_salary_deductions(UUID, DATE) TO authenticated;
