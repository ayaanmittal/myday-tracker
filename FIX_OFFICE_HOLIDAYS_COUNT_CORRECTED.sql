-- Fix the office holidays counting logic
-- Expected: 2 company holidays + 4 Sundays = 6 total office holidays
-- Currently showing: 4 (incorrect)

-- 1. Drop and recreate the get_employee_salary_summary function with corrected logic
DROP FUNCTION IF EXISTS public.get_employee_salary_summary(UUID, DATE);

-- 2. Create the corrected function
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
  v_company_holidays INTEGER := 0;
  v_sundays INTEGER := 0;
  v_net_salary DECIMAL(10,2) := 0;
  v_deduction_percentage DECIMAL(5,2) := 0;
  v_days_in_month INTEGER;
BEGIN
  -- Get the month boundaries
  v_month_start := DATE_TRUNC('month', p_month)::DATE;
  v_month_end := (DATE_TRUNC('month', p_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  v_days_in_month := EXTRACT(DAY FROM v_month_end);
  
  -- Get employee's base salary for the month
  SELECT es.base_salary INTO v_base_salary
  FROM public.employee_salaries es
  WHERE es.user_id = p_user_id
    AND es.is_active = true
    AND es.effective_from <= v_month_end
    AND (es.effective_to IS NULL OR es.effective_to >= v_month_start)
  ORDER BY es.effective_from DESC
  LIMIT 1;
  
  -- If no salary found, try to get any salary for this user
  IF v_base_salary IS NULL OR v_base_salary = 0 THEN
    SELECT es.base_salary INTO v_base_salary
    FROM public.employee_salaries es
    WHERE es.user_id = p_user_id
    ORDER BY es.effective_from DESC
    LIMIT 1;
  END IF;
  
  -- If still no salary, return zeros
  IF v_base_salary IS NULL OR v_base_salary = 0 THEN
    RETURN QUERY SELECT 0.00, 0, 0, 0, 0.00, 0.00, 0.00;
    RETURN;
  END IF;
  
  -- Calculate daily rate
  v_daily_rate := COALESCE(v_base_salary / v_days_in_month, 0);
  
  -- Count company holidays in the month
  SELECT COUNT(*)
  INTO v_company_holidays
  FROM public.company_holidays ch
  WHERE ch.holiday_date >= v_month_start
    AND ch.holiday_date <= v_month_end;
  
  -- Count Sundays in the month (should be 4 for October 2025)
  SELECT COUNT(*)
  INTO v_sundays
  FROM (
    SELECT generate_series(v_month_start, v_month_end, '1 day'::interval)::date as holiday_date
  ) sundays
  WHERE EXTRACT(DOW FROM holiday_date) = 0;
  
  -- Total office holidays = company holidays + Sundays
  v_office_holidays := v_company_holidays + v_sundays;
  
  -- Debug logging
  RAISE NOTICE 'Month: %, Company holidays: %, Sundays: %, Total office holidays: %', 
    p_month, v_company_holidays, v_sundays, v_office_holidays;
  
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
  INTO v_unpaid_leaves
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
  
  -- Calculate total deductions
  v_total_deductions := v_unpaid_leaves * v_daily_rate;
  
  -- Calculate net salary and deduction percentage
  v_net_salary := v_base_salary - v_total_deductions;
  v_deduction_percentage := CASE 
    WHEN v_base_salary > 0 THEN (v_total_deductions / v_base_salary * 100)
    ELSE 0 
  END;
  
  RETURN QUERY SELECT 
    v_total_deductions,
    v_paid_leaves,
    v_unpaid_leaves,
    v_office_holidays,
    v_base_salary,
    v_net_salary,
    v_deduction_percentage;
END;
$$;

-- 3. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_employee_salary_summary(UUID, DATE) TO authenticated;

-- 4. Test the function to verify the fix
SELECT 
  'Testing office holidays count fix' as test_name,
  total_deductions,
  total_paid_leaves,
  total_unpaid_leaves,
  total_office_holidays,
  base_salary,
  net_salary,
  deduction_percentage
FROM public.get_employee_salary_summary(
  (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1),
  '2025-10-01'
);

-- 5. Let's verify the individual counts
SELECT 
  'Company holidays in October 2025' as test_name,
  COUNT(*) as count,
  string_agg(title, ', ') as holidays
FROM public.company_holidays 
WHERE holiday_date >= '2025-10-01' AND holiday_date <= '2025-10-31';

-- 6. Count Sundays in October 2025
SELECT 
  'Sundays in October 2025' as test_name,
  COUNT(*) as count,
  string_agg(holiday_date::text, ', ') as sundays
FROM (
  SELECT generate_series('2025-10-01'::date, '2025-10-31'::date, '1 day'::interval)::date as holiday_date
) sundays
WHERE EXTRACT(DOW FROM holiday_date) = 0;



