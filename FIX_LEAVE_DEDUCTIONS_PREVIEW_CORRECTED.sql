-- FIX LEAVE DEDUCTIONS PREVIEW CALCULATION - CORRECTED VERSION
-- This script fixes the calculate_employee_leave_deductions function with proper column references

-- Step 1: Drop and recreate the function with corrected column references
DROP FUNCTION IF EXISTS public.calculate_employee_leave_deductions(UUID, DATE, NUMERIC);

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
  v_base_salary NUMERIC(12,2) := 0;
  v_daily_rate NUMERIC(12,2) := 0;
  v_unpaid_days INTEGER := 0;
  v_leave_deduction NUMERIC(12,2) := 0;
  v_net_salary NUMERIC(12,2) := 0;
  v_employee_name TEXT := 'Unknown';
  v_leave_record RECORD;
  v_is_office_holiday BOOLEAN;
  v_is_sunday BOOLEAN;
BEGIN
  -- Get month boundaries
  v_month_start := p_payment_month;
  v_month_end := p_payment_month + INTERVAL '1 month' - INTERVAL '1 day';
  
  -- Get employee name
  SELECT p.name INTO v_employee_name
  FROM public.profiles p
  WHERE p.id = p_user_id;
  
  -- Get employee base salary
  SELECT es.base_salary INTO v_base_salary
  FROM public.employee_salaries es
  WHERE es.user_id = p_user_id
    AND es.is_active = true
    AND es.effective_from <= v_month_end
    AND (es.effective_to IS NULL OR es.effective_to >= v_month_start)
  ORDER BY es.effective_from DESC
  LIMIT 1;
  
  -- If no salary found, return zero values
  IF v_base_salary IS NULL OR v_base_salary = 0 THEN
    RETURN QUERY SELECT
      v_employee_name,
      0::NUMERIC(12,2),
      0,
      0::NUMERIC(12,2),
      0,
      0::NUMERIC(12,2),
      0::NUMERIC(12,2),
      p_deduction_percentage;
    RETURN;
  END IF;
  
  -- Get employee work days configuration
  SELECT * INTO v_work_days_config
  FROM public.employee_work_days ewd
  WHERE ewd.user_id = p_user_id;
  
  -- If no work days configuration exists, use default (Mon-Sat)
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
  
  -- Calculate daily rate
  v_daily_rate := v_base_salary / v_work_days_in_month;
  
  -- Count unpaid leave days from the leaves table
  FOR v_leave_record IN
    SELECT 
      l.leave_date,
      l.is_paid_leave,
      l.is_approved
    FROM public.leaves l
    WHERE l.user_id = p_user_id
      AND l.leave_date BETWEEN v_month_start AND v_month_end
      AND l.is_paid_leave = false  -- Only unpaid leaves
      AND l.is_approved = true     -- Only approved leaves
  LOOP
    -- Check if this date is a work day
    v_day_of_week := EXTRACT(DOW FROM v_leave_record.leave_date);
    v_is_work_day := CASE v_day_of_week
      WHEN 0 THEN v_work_days_config.sunday
      WHEN 1 THEN v_work_days_config.monday
      WHEN 2 THEN v_work_days_config.tuesday
      WHEN 3 THEN v_work_days_config.wednesday
      WHEN 4 THEN v_work_days_config.thursday
      WHEN 5 THEN v_work_days_config.friday
      WHEN 6 THEN v_work_days_config.saturday
    END;
    
    -- Check if this date is an office holiday
    SELECT EXISTS(
      SELECT 1 FROM public.company_holidays ch
      WHERE ch.holiday_date = v_leave_record.leave_date
    ) INTO v_is_office_holiday;
    
    -- Check if this date is a Sunday
    v_is_sunday := (v_day_of_week = 0);
    
    -- Only count as unpaid if it's a work day AND not an office holiday AND not a Sunday
    IF v_is_work_day AND NOT v_is_office_holiday AND NOT v_is_sunday THEN
      v_unpaid_days := v_unpaid_days + 1;
    END IF;
  END LOOP;
  
  -- Calculate leave deduction
  v_leave_deduction := (v_daily_rate * v_unpaid_days) * (p_deduction_percentage / 100);
  
  -- Calculate net salary
  v_net_salary := v_base_salary - v_leave_deduction;
  
  -- Return the results
  RETURN QUERY SELECT
    v_employee_name,
    v_base_salary,
    v_work_days_in_month,
    v_daily_rate,
    v_unpaid_days,
    v_leave_deduction,
    v_net_salary,
    p_deduction_percentage;
END;
$$;

-- Step 2: Test the corrected function
SELECT 
  'Testing Corrected Function' as info,
  *
FROM public.calculate_employee_leave_deductions(
  (SELECT id FROM public.profiles WHERE name = 'Dolly Jhamb' LIMIT 1),
  '2025-10-01'::DATE,
  100.00
);

SELECT 
  'Testing Corrected Function' as info,
  *
FROM public.calculate_employee_leave_deductions(
  (SELECT id FROM public.profiles WHERE name = 'Isha Sharma' LIMIT 1),
  '2025-10-01'::DATE,
  100.00
);

SELECT 
  'Testing Corrected Function' as info,
  *
FROM public.calculate_employee_leave_deductions(
  (SELECT id FROM public.profiles WHERE name = 'Sakshi Saglotia' LIMIT 1),
  '2025-10-01'::DATE,
  100.00
);

SELECT 
  'Testing Corrected Function' as info,
  *
FROM public.calculate_employee_leave_deductions(
  (SELECT id FROM public.profiles WHERE name = 'Arjan Singh' LIMIT 1),
  '2025-10-01'::DATE,
  100.00
);

-- Step 3: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_employee_leave_deductions(UUID, DATE, NUMERIC) TO authenticated;
