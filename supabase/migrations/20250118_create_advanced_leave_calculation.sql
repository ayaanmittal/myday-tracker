-- Create advanced leave calculation function for salary management
-- This function provides detailed leave deduction calculations with work days consideration

CREATE OR REPLACE FUNCTION public.calculate_employee_leave_deductions(
  p_user_id UUID,
  p_payment_month DATE,
  p_deduction_percentage NUMERIC(5,2) DEFAULT 100.00
)
RETURNS TABLE(
  employee_name TEXT,
  base_salary NUMERIC(12,2),
  work_days_in_month INTEGER,
  daily_rate NUMERIC(12,2),
  unpaid_leave_days INTEGER,
  leave_deduction_amount NUMERIC(12,2),
  net_salary NUMERIC(12,2),
  deduction_percentage NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_work_days_config RECORD;
  v_work_days_in_month INTEGER := 0;
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_is_work_day BOOLEAN;
  v_month_start DATE;
  v_month_end DATE;
  v_base_salary NUMERIC(12,2);
  v_daily_rate NUMERIC(12,2);
  v_unpaid_days INTEGER := 0;
  v_leave_deduction NUMERIC(12,2);
  v_net_salary NUMERIC(12,2);
BEGIN
  -- Get month boundaries
  v_month_start := p_payment_month;
  v_month_end := p_payment_month + INTERVAL '1 month' - INTERVAL '1 day';
  
  -- Get employee details and base salary
  SELECT 
    p.name,
    es.base_salary
  INTO 
    employee_name,
    v_base_salary
  FROM public.profiles p
  JOIN public.employee_salaries es ON es.user_id = p.user_id
  WHERE p.user_id = p_user_id
    AND es.is_active = true
    AND es.effective_from <= p_payment_month
    AND (es.effective_to IS NULL OR es.effective_to >= p_payment_month)
  ORDER BY es.effective_from DESC
  LIMIT 1;
  
  IF employee_name IS NULL OR v_base_salary IS NULL THEN
    RETURN;
  END IF;
  
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
    v_day_of_week := EXTRACT(DOW FROM v_current_date); -- 0 = Sunday, 1 = Monday, etc.
    
    -- Determine if this is a work day
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
  
  -- Calculate daily rate based on actual work days
  v_daily_rate := v_base_salary / v_work_days_in_month;
  
  -- Count unpaid leave days from attendance
  SELECT COUNT(*) INTO v_unpaid_days
  FROM public.unified_attendance
  WHERE user_id = p_user_id
    AND entry_date BETWEEN v_month_start AND v_month_end
    AND (status = 'absent' OR manual_status = 'absent');
  
  -- Calculate leave deduction
  v_leave_deduction := (v_daily_rate * v_unpaid_days) * (p_deduction_percentage / 100);
  
  -- Calculate net salary
  v_net_salary := v_base_salary - v_leave_deduction;
  
  -- Return the results
  RETURN QUERY SELECT
    employee_name,
    v_base_salary,
    v_work_days_in_month,
    v_daily_rate,
    v_unpaid_days,
    v_leave_deduction,
    v_net_salary,
    p_deduction_percentage;
END;
$$;

-- Create a function to get work days summary for an employee
CREATE OR REPLACE FUNCTION public.get_employee_work_days_summary(
  p_user_id UUID,
  p_payment_month DATE
)
RETURNS TABLE(
  total_days_in_month INTEGER,
  work_days_in_month INTEGER,
  weekend_days INTEGER,
  work_days_config JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_work_days_config RECORD;
  v_work_days_in_month INTEGER := 0;
  v_weekend_days INTEGER := 0;
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_is_work_day BOOLEAN;
  v_month_start DATE;
  v_month_end DATE;
  v_total_days INTEGER;
BEGIN
  -- Get month boundaries
  v_month_start := p_payment_month;
  v_month_end := p_payment_month + INTERVAL '1 month' - INTERVAL '1 day';
  v_total_days := EXTRACT(DAY FROM v_month_end);
  
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
  
  -- Calculate work days and weekend days in the month
  v_current_date := v_month_start;
  WHILE v_current_date <= v_month_end LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date); -- 0 = Sunday, 1 = Monday, etc.
    
    -- Determine if this is a work day
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
    ELSE
      v_weekend_days := v_weekend_days + 1;
    END IF;
    
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  
  -- Return the results
  RETURN QUERY SELECT
    v_total_days,
    v_work_days_in_month,
    v_weekend_days,
    jsonb_build_object(
      'monday', v_work_days_config.monday,
      'tuesday', v_work_days_config.tuesday,
      'wednesday', v_work_days_config.wednesday,
      'thursday', v_work_days_config.thursday,
      'friday', v_work_days_config.friday,
      'saturday', v_work_days_config.saturday,
      'sunday', v_work_days_config.sunday
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_employee_leave_deductions(UUID, DATE, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_work_days_summary(UUID, DATE) TO authenticated;
