-- Fix the calculate_daily_salary_rate function to use actual work days
-- This is the root cause of the issue where employees show "based on 1 work days"

-- Drop and recreate the function with proper work days calculation
DROP FUNCTION IF EXISTS public.calculate_daily_salary_rate(UUID, DATE);

CREATE OR REPLACE FUNCTION public.calculate_daily_salary_rate(
  p_user_id UUID,
  p_payment_month DATE
)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
AS $$
DECLARE
  v_base_salary NUMERIC(12,2);
  v_work_days_config RECORD;
  v_work_days_in_month INTEGER := 0;
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_is_work_day BOOLEAN;
  v_month_start DATE;
  v_month_end DATE;
BEGIN
  -- Get the base salary for the user
  SELECT base_salary INTO v_base_salary
  FROM public.employee_salaries
  WHERE user_id = p_user_id
    AND effective_from <= p_payment_month
    AND (effective_to IS NULL OR effective_to >= p_payment_month)
    AND is_active = true
  ORDER BY effective_from DESC
  LIMIT 1;
  
  IF v_base_salary IS NULL THEN
    RETURN 0;
  END IF;
  
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
  
  -- Ensure we have at least 1 work day to avoid division by zero
  IF v_work_days_in_month = 0 THEN
    v_work_days_in_month := 1;
  END IF;
  
  -- Return daily rate based on actual work days
  RETURN v_base_salary / v_work_days_in_month;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_daily_salary_rate(UUID, DATE) TO authenticated;

-- Test the function with a sample employee
SELECT 'Test: calculate_daily_salary_rate function' as step;
SELECT 
  p.name,
  calculate_daily_salary_rate(p.user_id, '2024-01-01'::DATE) as daily_rate
FROM profiles p
WHERE p.is_active = true
LIMIT 5;

