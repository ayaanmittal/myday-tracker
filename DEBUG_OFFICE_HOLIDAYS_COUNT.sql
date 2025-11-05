-- Debug the office holidays counting issue
-- Let's check what's actually in the database and fix the counting logic

-- 1. First, let's see what company holidays exist for October 2025
SELECT 
  'Company holidays in October 2025' as test_name,
  holiday_date,
  title,
  EXTRACT(DOW FROM holiday_date) as day_of_week,
  CASE EXTRACT(DOW FROM holiday_date)
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
  END as day_name
FROM public.company_holidays 
WHERE holiday_date >= '2025-10-01' AND holiday_date <= '2025-10-31'
ORDER BY holiday_date;

-- 2. Count company holidays
SELECT 
  'Company holidays count' as test_name,
  COUNT(*) as count
FROM public.company_holidays 
WHERE holiday_date >= '2025-10-01' AND holiday_date <= '2025-10-31';

-- 3. Check all Sundays in October 2025
SELECT 
  'All Sundays in October 2025' as test_name,
  holiday_date,
  EXTRACT(DOW FROM holiday_date) as day_of_week
FROM (
  SELECT generate_series('2025-10-01'::date, '2025-10-31'::date, '1 day'::interval)::date as holiday_date
) all_days
WHERE EXTRACT(DOW FROM holiday_date) = 0
ORDER BY holiday_date;

-- 4. Count Sundays
SELECT 
  'Sundays count' as test_name,
  COUNT(*) as count
FROM (
  SELECT generate_series('2025-10-01'::date, '2025-10-31'::date, '1 day'::interval)::date as holiday_date
) sundays
WHERE EXTRACT(DOW FROM holiday_date) = 0;

-- 5. If company holidays are missing, let's insert them
INSERT INTO public.company_holidays (holiday_date, title, created_by)
VALUES 
  ('2025-10-20', 'Diwali', (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1)),
  ('2025-10-21', 'Diwali Holiday', (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1))
ON CONFLICT (holiday_date) DO UPDATE SET 
  title = EXCLUDED.title;

-- 6. Now let's test the RPC function again
SELECT 
  'Testing RPC function after data fix' as test_name,
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

-- 7. Let's also create a simple test function to debug the counting
CREATE OR REPLACE FUNCTION debug_office_holidays_count(p_month DATE)
RETURNS TABLE(
  company_holidays INTEGER,
  sundays INTEGER,
  total_office_holidays INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_month_start DATE;
  v_month_end DATE;
  v_company_holidays INTEGER := 0;
  v_sundays INTEGER := 0;
BEGIN
  v_month_start := DATE_TRUNC('month', p_month)::DATE;
  v_month_end := (DATE_TRUNC('month', p_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Count company holidays
  SELECT COUNT(*)
  INTO v_company_holidays
  FROM public.company_holidays ch
  WHERE ch.holiday_date >= v_month_start
    AND ch.holiday_date <= v_month_end;
  
  -- Count Sundays
  SELECT COUNT(*)
  INTO v_sundays
  FROM (
    SELECT generate_series(v_month_start, v_month_end, '1 day'::interval)::date as holiday_date
  ) sundays
  WHERE EXTRACT(DOW FROM holiday_date) = 0;
  
  RETURN QUERY SELECT v_company_holidays, v_sundays, (v_company_holidays + v_sundays);
END;
$$;

-- 8. Test the debug function
SELECT 
  'Debug office holidays count' as test_name,
  *
FROM debug_office_holidays_count('2025-10-01');



