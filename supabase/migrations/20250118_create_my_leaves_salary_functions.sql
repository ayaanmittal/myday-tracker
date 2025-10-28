-- Create functions for My Leaves & Salary page
-- This migration creates functions to get employee leaves with salary deductions

-- Function to get employee leaves with salary deduction calculations
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
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  notes TEXT,
  daily_rate NUMERIC(12,2),
  deduction_amount NUMERIC(12,2),
  is_office_holiday BOOLEAN,
  deduction_reason TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_month_start DATE;
  v_month_end DATE;
  v_base_salary NUMERIC(12,2);
  v_work_days_config RECORD;
  v_work_days_in_month INTEGER := 0;
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_is_work_day BOOLEAN;
  v_daily_rate NUMERIC(12,2);
BEGIN
  -- Get month boundaries
  v_month_start := p_month;
  v_month_end := p_month + INTERVAL '1 month' - INTERVAL '1 day';

  -- Get base salary for the month
  SELECT es.base_salary INTO v_base_salary
  FROM public.employee_salaries es
  WHERE es.user_id = p_user_id
    AND es.is_active = true
    AND es.effective_from <= p_month
    AND (es.effective_to IS NULL OR es.effective_to >= p_month)
  ORDER BY es.effective_from DESC
  LIMIT 1;

  -- Get employee work days configuration
  SELECT * INTO v_work_days_config
  FROM public.employee_work_days
  WHERE user_id = p_user_id;

  -- If no work days configuration exists, use default (Mon-Fri)
  IF v_work_days_config IS NULL THEN
    v_work_days_config.monday := true;
    v_work_days_config.tuesday := true;
    v_work_days_config.wednesday := true;
    v_work_days_config.thursday := true;
    v_work_days_config.friday := true;
    v_work_days_config.saturday := false;
    v_work_days_config.sunday := false;
  END IF;

  -- Calculate work days in the month
  v_current_date := v_month_start;
  WHILE v_current_date <= v_month_end LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date);
    
    v_is_work_day := CASE v_day_of_week
      WHEN 0 THEN v_work_days_config.sunday
      WHEN 1 THEN v_work_days_config.monday
      WHEN 2 THEN v_work_days_config.tuesday
      WHEN 3 THEN v_work_days_config.wednesday
      WHEN 4 THEN v_work_days_config.thursday
      WHEN 5 THEN v_work_days_config.friday
      WHEN 6 THEN v_work_days_config.saturday
    END;
    
    IF v_is_work_day THEN
      v_work_days_in_month := v_work_days_in_month + 1;
    END IF;
    
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  -- Calculate daily rate
  IF v_work_days_in_month > 0 AND v_base_salary IS NOT NULL THEN
    v_daily_rate := v_base_salary / v_work_days_in_month;
  ELSE
    v_daily_rate := 0;
  END IF;

  -- Return leaves with salary deduction calculations
  RETURN QUERY
  SELECT 
    l.id,
    l.user_id,
    l.leave_date,
    l.leave_type_name,
    l.is_paid_leave,
    l.is_approved,
    l.approved_by,
    l.approved_at,
    l.created_at,
    l.notes,
    v_daily_rate as daily_rate,
    CASE 
      WHEN l.is_paid_leave THEN 0
      WHEN EXISTS (SELECT 1 FROM public.company_holidays WHERE holiday_date = l.leave_date) THEN 0
      ELSE v_daily_rate
    END as deduction_amount,
    EXISTS (SELECT 1 FROM public.company_holidays WHERE holiday_date = l.leave_date) as is_office_holiday,
    CASE 
      WHEN l.is_paid_leave THEN 'Paid leave - no deduction'
      WHEN EXISTS (SELECT 1 FROM public.company_holidays WHERE holiday_date = l.leave_date) THEN 'Office holiday - no deduction'
      ELSE 'Unpaid leave - salary deducted'
    END as deduction_reason
  FROM public.leaves l
  WHERE l.user_id = p_user_id
    AND l.leave_date BETWEEN v_month_start AND v_month_end
  ORDER BY l.leave_date DESC;
END;
$$;

-- Function to get employee salary summary for a month
CREATE OR REPLACE FUNCTION public.get_employee_salary_summary(
  p_user_id UUID,
  p_month DATE
)
RETURNS TABLE(
  total_deductions NUMERIC(12,2),
  total_paid_leaves INTEGER,
  total_unpaid_leaves INTEGER,
  total_office_holidays INTEGER,
  base_salary NUMERIC(12,2),
  net_salary NUMERIC(12,2),
  deduction_percentage NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_month_start DATE;
  v_month_end DATE;
  v_base_salary NUMERIC(12,2);
  v_total_deductions NUMERIC(12,2) := 0;
  v_paid_leaves INTEGER := 0;
  v_unpaid_leaves INTEGER := 0;
  v_office_holidays INTEGER := 0;
  v_net_salary NUMERIC(12,2);
  v_deduction_percentage NUMERIC(5,2);
BEGIN
  -- Get month boundaries
  v_month_start := p_month;
  v_month_end := p_month + INTERVAL '1 month' - INTERVAL '1 day';

  -- Get base salary
  SELECT es.base_salary INTO v_base_salary
  FROM public.employee_salaries es
  WHERE es.user_id = p_user_id
    AND es.is_active = true
    AND es.effective_from <= p_month
    AND (es.effective_to IS NULL OR es.effective_to >= p_month)
  ORDER BY es.effective_from DESC
  LIMIT 1;

  -- Calculate deductions and counts
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN l.is_paid_leave THEN 0
        WHEN EXISTS (SELECT 1 FROM public.company_holidays WHERE holiday_date = l.leave_date) THEN 0
        ELSE (es.base_salary / NULLIF(
          (SELECT COUNT(*) FROM generate_series(v_month_start, v_month_end, '1 day'::interval) as day
           WHERE EXTRACT(DOW FROM day) IN (1,2,3,4,5,6,7) -- This is a simplified work days calculation
           AND NOT EXISTS (SELECT 1 FROM public.company_holidays WHERE holiday_date = day::date)
          ), 0))
      END
    ), 0),
    COUNT(*) FILTER (WHERE l.is_paid_leave = true),
    COUNT(*) FILTER (WHERE l.is_paid_leave = false AND NOT EXISTS (SELECT 1 FROM public.company_holidays WHERE holiday_date = l.leave_date)),
    COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.company_holidays WHERE holiday_date = l.leave_date))
  INTO v_total_deductions, v_paid_leaves, v_unpaid_leaves, v_office_holidays
  FROM public.leaves l
  CROSS JOIN public.employee_salaries es
  WHERE l.user_id = p_user_id
    AND l.leave_date BETWEEN v_month_start AND v_month_end
    AND es.user_id = p_user_id
    AND es.is_active = true
    AND es.effective_from <= p_month
    AND (es.effective_to IS NULL OR es.effective_to >= p_month);

  -- Calculate net salary and deduction percentage
  v_net_salary := COALESCE(v_base_salary, 0) - COALESCE(v_total_deductions, 0);
  v_deduction_percentage := CASE 
    WHEN v_base_salary > 0 THEN (v_total_deductions / v_base_salary) * 100
    ELSE 0
  END;

  RETURN QUERY SELECT
    COALESCE(v_total_deductions, 0),
    COALESCE(v_paid_leaves, 0),
    COALESCE(v_unpaid_leaves, 0),
    COALESCE(v_office_holidays, 0),
    COALESCE(v_base_salary, 0),
    v_net_salary,
    v_deduction_percentage;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_employee_leaves_with_salary_deductions(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_salary_summary(UUID, DATE) TO authenticated;

