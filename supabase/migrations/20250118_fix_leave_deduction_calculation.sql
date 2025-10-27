-- Fix leave deduction calculation to properly consider employee work days
-- This migration updates the calculate_month_leave_deductions function to use employee work days

-- Drop and recreate the function with proper work days calculation
DROP FUNCTION IF EXISTS public.calculate_month_leave_deductions(UUID, DATE);

CREATE OR REPLACE FUNCTION public.calculate_month_leave_deductions(
  p_user_id UUID,
  p_payment_month DATE
)
RETURNS TABLE(
  total_unpaid_days INTEGER,
  total_deduction_amount NUMERIC(12,2),
  daily_rate NUMERIC(12,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_daily_rate NUMERIC(12,2);
  v_month_start DATE;
  v_month_end DATE;
  v_work_days_config RECORD;
  v_work_days_in_month INTEGER := 0;
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_is_work_day BOOLEAN;
BEGIN
  -- Get month boundaries
  v_month_start := p_payment_month;
  v_month_end := p_payment_month + INTERVAL '1 month' - INTERVAL '1 day';
  
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
  v_daily_rate := calculate_daily_salary_rate(p_user_id, p_payment_month);
  
  -- If work days calculation is different from the default, recalculate daily rate
  IF v_work_days_in_month > 0 THEN
    -- Get base salary
    DECLARE
      v_base_salary NUMERIC(12,2);
    BEGIN
      SELECT base_salary INTO v_base_salary
      FROM public.employee_salaries
      WHERE user_id = p_user_id
        AND effective_from <= p_payment_month
        AND (effective_to IS NULL OR effective_to >= p_payment_month)
        AND is_active = true
      ORDER BY effective_from DESC
      LIMIT 1;
      
      IF v_base_salary IS NOT NULL THEN
        v_daily_rate := v_base_salary / v_work_days_in_month;
      END IF;
    END;
  END IF;
  
  -- Calculate deductions based on attendance
  RETURN QUERY
  WITH attendance_summary AS (
    SELECT 
      COUNT(*) FILTER (WHERE status = 'absent' AND manual_status IS NULL) as unpaid_absent_days,
      COUNT(*) FILTER (WHERE manual_status = 'absent') as manual_absent_days
    FROM public.unified_attendance
    WHERE user_id = p_user_id
      AND entry_date BETWEEN v_month_start AND v_month_end
  )
  SELECT 
    (att_summary.unpaid_absent_days + att_summary.manual_absent_days)::INTEGER as total_unpaid_days,
    ((att_summary.unpaid_absent_days + att_summary.manual_absent_days) * v_daily_rate)::NUMERIC(12,2) as total_deduction_amount,
    v_daily_rate as daily_rate
  FROM attendance_summary att_summary;
END;
$$;

-- Create a helper function to get work days configuration with defaults
CREATE OR REPLACE FUNCTION public.get_employee_work_days_config(p_user_id UUID)
RETURNS TABLE(
  monday BOOLEAN,
  tuesday BOOLEAN,
  wednesday BOOLEAN,
  thursday BOOLEAN,
  friday BOOLEAN,
  saturday BOOLEAN,
  sunday BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(ewd.monday, true) as monday,
    COALESCE(ewd.tuesday, true) as tuesday,
    COALESCE(ewd.wednesday, true) as wednesday,
    COALESCE(ewd.thursday, true) as thursday,
    COALESCE(ewd.friday, true) as friday,
    COALESCE(ewd.saturday, false) as saturday,
    COALESCE(ewd.sunday, false) as sunday
  FROM public.employee_work_days ewd
  WHERE ewd.user_id = p_user_id
  
  UNION ALL
  
  -- Default work days if no record exists
  SELECT 
    true as monday,
    true as tuesday,
    true as wednesday,
    true as thursday,
    true as friday,
    false as saturday,
    false as sunday
  WHERE NOT EXISTS (
    SELECT 1 FROM public.employee_work_days 
    WHERE user_id = p_user_id
  )
  LIMIT 1;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_month_leave_deductions(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_work_days_config(UUID) TO authenticated;
