-- Fix Arjan Singh's work days configuration and holiday handling
-- This migration addresses the specific issues with Arjan Singh's salary calculation

-- Step 1: Update Arjan Singh's work days to Mon-Sat (6 days per week)
UPDATE employee_work_days 
SET 
  monday = true,
  tuesday = true,
  wednesday = true,
  thursday = true,
  friday = true,
  saturday = true,  -- Arjan works on Saturday
  sunday = false    -- Sunday is office holiday
WHERE user_id = (
  SELECT user_id FROM profiles 
  WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%'
  LIMIT 1
);

-- If no work days record exists, create one
INSERT INTO employee_work_days (user_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday)
SELECT 
  p.user_id,
  true as monday,
  true as tuesday,
  true as wednesday,
  true as thursday,
  true as friday,
  true as saturday,  -- Arjan works on Saturday
  false as sunday   -- Sunday is office holiday
FROM profiles p
WHERE (p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%')
  AND NOT EXISTS (
    SELECT 1 FROM employee_work_days ewd 
    WHERE ewd.user_id = p.user_id
  )
ON CONFLICT (user_id) DO UPDATE SET
  monday = EXCLUDED.monday,
  tuesday = EXCLUDED.tuesday,
  wednesday = EXCLUDED.wednesday,
  thursday = EXCLUDED.thursday,
  friday = EXCLUDED.friday,
  saturday = EXCLUDED.saturday,
  sunday = EXCLUDED.sunday;

-- Step 2: Fix the calculate_month_leave_deductions function to exclude office holidays
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
BEGIN
  -- Calculate daily rate
  v_daily_rate := calculate_daily_salary_rate(p_user_id, p_payment_month);
  
  -- Get month boundaries
  v_month_start := p_payment_month;
  v_month_end := p_payment_month + INTERVAL '1 month' - INTERVAL '1 day';
  
  -- Calculate deductions based on attendance, EXCLUDING office holidays
  RETURN QUERY
  WITH attendance_summary AS (
    SELECT 
      COUNT(*) FILTER (WHERE status = 'absent' AND manual_status IS NULL) as unpaid_absent_days,
      COUNT(*) FILTER (WHERE manual_status = 'absent') as manual_absent_days
    FROM public.unified_attendance
    WHERE user_id = p_user_id
      AND entry_date BETWEEN v_month_start AND v_month_end
      -- EXCLUDE office holidays from unpaid leave calculation
      AND status != 'office_holiday'
      AND (manual_status IS NULL OR manual_status != 'office_holiday')
  )
  SELECT 
    (att_summary.unpaid_absent_days + att_summary.manual_absent_days)::INTEGER as total_unpaid_days,
    ((att_summary.unpaid_absent_days + att_summary.manual_absent_days) * v_daily_rate)::NUMERIC(12,2) as total_deduction_amount,
    v_daily_rate as daily_rate
  FROM attendance_summary att_summary;
END;
$$;

-- Step 3: Fix the calculate_daily_salary_rate function to use correct work days
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

-- Step 4: Create a function to check attendance for unpaid leave calculation
CREATE OR REPLACE FUNCTION public.calculate_unpaid_leave_days(
  p_user_id UUID,
  p_payment_month DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_month_start DATE;
  v_month_end DATE;
  v_unpaid_days INTEGER := 0;
BEGIN
  -- Get month boundaries
  v_month_start := p_payment_month;
  v_month_end := p_payment_month + INTERVAL '1 month' - INTERVAL '1 day';
  
  -- Count unpaid leave days, EXCLUDING office holidays
  SELECT COUNT(*) INTO v_unpaid_days
  FROM public.unified_attendance
  WHERE user_id = p_user_id
    AND entry_date BETWEEN v_month_start AND v_month_end
    AND (status = 'absent' OR manual_status = 'absent')
    -- EXCLUDE office holidays
    AND status != 'office_holiday'
    AND (manual_status IS NULL OR manual_status != 'office_holiday');
  
  RETURN v_unpaid_days;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_daily_salary_rate(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_month_leave_deductions(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_unpaid_leave_days(UUID, DATE) TO authenticated;

-- Step 5: Test the fix
SELECT 'Test: Arjan Singh work days and leave calculation' as step;
SELECT 
  p.name,
  ewd.monday,
  ewd.tuesday,
  ewd.wednesday,
  ewd.thursday,
  ewd.friday,
  ewd.saturday,
  ewd.sunday
FROM profiles p
JOIN employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%';

-- Test work days calculation for January 2024
SELECT 'Test: Work days calculation for January 2024' as step;
WITH work_days_config AS (
  SELECT * FROM get_employee_work_days(
    (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1)
  )
),
month_days AS (
  SELECT 
    generate_series(
      '2024-01-01'::DATE,
      '2024-01-31'::DATE,
      '1 day'::INTERVAL
    )::DATE as day
),
work_days_calc AS (
  SELECT 
    md.day,
    EXTRACT(DOW FROM md.day) as day_of_week,
    CASE EXTRACT(DOW FROM md.day)
      WHEN 0 THEN wdc.sunday
      WHEN 1 THEN wdc.monday
      WHEN 2 THEN wdc.tuesday
      WHEN 3 THEN wdc.wednesday
      WHEN 4 THEN wdc.thursday
      WHEN 5 THEN wdc.friday
      WHEN 6 THEN wdc.saturday
    END as is_work_day
  FROM month_days md
  CROSS JOIN work_days_config wdc
)
SELECT 
  COUNT(*) as total_days,
  COUNT(*) FILTER (WHERE is_work_day = true) as work_days,
  COUNT(*) FILTER (WHERE is_work_day = false) as non_work_days
FROM work_days_calc;

-- Test leave deduction calculation
SELECT 'Test: Leave deduction calculation' as step;
SELECT * FROM calculate_month_leave_deductions(
  (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1),
  '2024-01-01'::DATE
);

-- Test unpaid leave days
SELECT 'Test: Unpaid leave days' as step;
SELECT calculate_unpaid_leave_days(
  (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1),
  '2024-01-01'::DATE
) as unpaid_leave_days;

