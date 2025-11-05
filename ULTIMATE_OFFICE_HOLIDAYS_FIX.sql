-- Ultimate fix for office holidays count issue
-- The database shows 6 but frontend shows 4 - need to force complete refresh

-- 1. First, let's verify what's actually in the company_holidays table
SELECT 
  'Current company holidays' as test_name,
  holiday_date,
  title
FROM public.company_holidays 
WHERE holiday_date >= '2025-10-01' AND holiday_date <= '2025-10-31'
ORDER BY holiday_date;

-- 2. Ensure we have the correct holidays
DELETE FROM public.company_holidays 
WHERE holiday_date IN ('2025-10-20', '2025-10-21');

INSERT INTO public.company_holidays (holiday_date, title, created_by)
VALUES 
  ('2025-10-20', 'Diwali', (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1)),
  ('2025-10-21', 'Diwali Holiday', (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1));

-- 3. Completely drop and recreate the function with a different approach
DROP FUNCTION IF EXISTS public.get_employee_salary_summary(UUID, DATE);

-- 4. Create a completely new function with explicit counting
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
  
  -- Count office holidays using a single query with UNION
  SELECT COUNT(*) INTO v_office_holidays
  FROM (
    -- Company holidays
    SELECT holiday_date
    FROM public.company_holidays
    WHERE holiday_date >= v_month_start AND holiday_date <= v_month_end
    
    UNION
    
    -- Sundays
    SELECT generate_series(v_month_start, v_month_end, '1 day'::interval)::date as holiday_date
    WHERE EXTRACT(DOW FROM generate_series(v_month_start, v_month_end, '1 day'::interval)) = 0
  ) all_holidays;
  
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

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_employee_salary_summary(UUID, DATE) TO authenticated;

-- 6. Test the function
SELECT 
  'Testing ultimate fix' as test_name,
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

-- 7. Also create a simple test function to verify the count
CREATE OR REPLACE FUNCTION test_office_holidays_count(p_month DATE)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM (
    -- Company holidays
    SELECT holiday_date
    FROM public.company_holidays
    WHERE holiday_date >= DATE_TRUNC('month', p_month)::DATE 
      AND holiday_date <= (DATE_TRUNC('month', p_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE
    
    UNION
    
    -- Sundays
    SELECT generate_series(
      DATE_TRUNC('month', p_month)::DATE, 
      (DATE_TRUNC('month', p_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE, 
      '1 day'::interval
    )::date as holiday_date
    WHERE EXTRACT(DOW FROM generate_series(
      DATE_TRUNC('month', p_month)::DATE, 
      (DATE_TRUNC('month', p_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE, 
      '1 day'::interval
    )) = 0
  ) all_holidays;
  
  RETURN v_count;
END;
$$;

-- 8. Test the simple function
SELECT 
  'Simple test function result' as test_name,
  test_office_holidays_count('2025-10-01') as office_holidays_count;

-- 9. Force schema refresh
NOTIFY pgrst, 'reload schema';



