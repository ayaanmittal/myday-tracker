-- Simplified leave deduction calculation for debugging
-- This version has more detailed logging and simpler logic

CREATE OR REPLACE FUNCTION public.debug_leave_deduction_calculation(
  p_user_id UUID,
  p_payment_month DATE
)
RETURNS TABLE(
  employee_name TEXT,
  base_salary NUMERIC(12,2),
  work_days_in_month INTEGER,
  daily_rate NUMERIC(12,2),
  total_leaves_in_month INTEGER,
  unpaid_leaves_in_month INTEGER,
  approved_unpaid_leaves INTEGER,
  work_day_unpaid_leaves INTEGER,
  final_unpaid_days INTEGER,
  leave_deduction_amount NUMERIC(12,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_month_start DATE;
  v_month_end DATE;
  v_base_salary NUMERIC(12,2);
  v_employee_name TEXT;
  v_work_days_config RECORD;
  v_work_days_in_month INTEGER := 0;
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_is_work_day BOOLEAN;
  v_daily_rate NUMERIC(12,2);
  v_total_leaves INTEGER := 0;
  v_unpaid_leaves INTEGER := 0;
  v_approved_unpaid_leaves INTEGER := 0;
  v_work_day_unpaid_leaves INTEGER := 0;
  v_final_unpaid_days INTEGER := 0;
  v_leave_deduction NUMERIC(12,2);
  v_leave_record RECORD;
BEGIN
  -- Get month boundaries
  v_month_start := p_payment_month;
  v_month_end := p_payment_month + INTERVAL '1 month' - INTERVAL '1 day';
  
  -- Get employee details and base salary
  SELECT 
    p.name,
    COALESCE(es.base_salary, 0)
  INTO 
    v_employee_name,
    v_base_salary
  FROM public.profiles p
  LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id
    AND es.is_active = true
    AND es.effective_from <= p_payment_month
    AND (es.effective_to IS NULL OR es.effective_to >= p_payment_month)
  WHERE p.user_id = p_user_id
  ORDER BY es.effective_from DESC
  LIMIT 1;
  
  IF v_employee_name IS NULL THEN
    v_employee_name := 'Unknown Employee';
  END IF;
  
  -- Get employee work days configuration
  SELECT * INTO v_work_days_config
  FROM public.employee_work_days
  WHERE user_id = p_user_id;
  
  -- Default work days (Mon-Sat)
  IF v_work_days_config IS NULL THEN
    v_work_days_config.monday := true;
    v_work_days_config.tuesday := true;
    v_work_days_config.wednesday := true;
    v_work_days_config.thursday := true;
    v_work_days_config.friday := true;
    v_work_days_config.saturday := true;
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
  
  -- Ensure we have at least 1 work day
  IF v_work_days_in_month = 0 THEN
    v_work_days_in_month := 1;
  END IF;
  
  -- Calculate daily rate
  v_daily_rate := v_base_salary / v_work_days_in_month;
  
  -- Count all leaves in the month
  SELECT COUNT(*) INTO v_total_leaves
  FROM public.leaves
  WHERE user_id = p_user_id
    AND leave_date BETWEEN v_month_start AND v_month_end;
  
  -- Count unpaid leaves in the month
  SELECT COUNT(*) INTO v_unpaid_leaves
  FROM public.leaves
  WHERE user_id = p_user_id
    AND leave_date BETWEEN v_month_start AND v_month_end
    AND is_paid_leave = false;
  
  -- Count approved unpaid leaves in the month
  SELECT COUNT(*) INTO v_approved_unpaid_leaves
  FROM public.leaves
  WHERE user_id = p_user_id
    AND leave_date BETWEEN v_month_start AND v_month_end
    AND is_paid_leave = false
    AND is_approved = true;
  
  -- Count work day unpaid leaves (excluding office holidays and Sundays)
  FOR v_leave_record IN
    SELECT 
      l.leave_date,
      l.is_paid_leave,
      l.is_office_holiday,
      l.is_approved
    FROM public.leaves l
    WHERE l.user_id = p_user_id
      AND l.leave_date BETWEEN v_month_start AND v_month_end
      AND l.is_paid_leave = false
      AND l.is_approved = true
  LOOP
    v_current_date := v_leave_record.leave_date;
    v_day_of_week := EXTRACT(DOW FROM v_current_date);
    
    -- Check if this is a work day
    v_is_work_day := CASE v_day_of_week
      WHEN 0 THEN v_work_days_config.sunday
      WHEN 1 THEN v_work_days_config.monday
      WHEN 2 THEN v_work_days_config.tuesday
      WHEN 3 THEN v_work_days_config.wednesday
      WHEN 4 THEN v_work_days_config.thursday
      WHEN 5 THEN v_work_days_config.friday
      WHEN 6 THEN v_work_days_config.saturday
    END;
    
    -- Check if this is an office holiday
    IF NOT v_leave_record.is_office_holiday AND v_is_work_day THEN
      v_work_day_unpaid_leaves := v_work_day_unpaid_leaves + 1;
    END IF;
  END LOOP;
  
  v_final_unpaid_days := v_work_day_unpaid_leaves;
  v_leave_deduction := v_daily_rate * v_final_unpaid_days;
  
  -- Return debug information
  RETURN QUERY SELECT
    v_employee_name,
    v_base_salary,
    v_work_days_in_month,
    v_daily_rate,
    v_total_leaves,
    v_unpaid_leaves,
    v_approved_unpaid_leaves,
    v_work_day_unpaid_leaves,
    v_final_unpaid_days,
    v_leave_deduction;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.debug_leave_deduction_calculation(UUID, DATE) TO authenticated;
