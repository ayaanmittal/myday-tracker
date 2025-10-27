-- Fix the set-returning function error in WHERE clause
-- This will resolve the generate_series issue

-- 1. Drop and recreate the RPC functions with fixed logic
DROP FUNCTION IF EXISTS public.get_employee_salary_summary(UUID, DATE);
DROP FUNCTION IF EXISTS public.get_employee_leaves_with_salary_deductions(UUID, DATE);
DROP FUNCTION IF EXISTS public.get_employee_salary_payment(UUID, DATE);

-- 2. Create the get_employee_salary_summary function with fixed Sunday logic
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
  
  -- Count company holidays in the month
  SELECT COUNT(*)
  INTO v_office_holidays
  FROM public.company_holidays ch
  WHERE ch.holiday_date >= v_month_start
    AND ch.holiday_date <= v_month_end;
  
  -- Count Sundays in the month (fixed logic)
  WITH sundays AS (
    SELECT generate_series(v_month_start, v_month_end, '1 day'::interval)::date as holiday_date
  )
  SELECT COUNT(*)
  INTO v_office_holidays
  FROM sundays
  WHERE EXTRACT(DOW FROM holiday_date) = 0;
  
  -- Add Sundays to office holidays count
  v_office_holidays := v_office_holidays + (
    SELECT COUNT(*)
    FROM (
      SELECT generate_series(v_month_start, v_month_end, '1 day'::interval)::date as holiday_date
    ) sundays
    WHERE EXTRACT(DOW FROM holiday_date) = 0
  );
  
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

-- 3. Create the get_employee_leaves_with_salary_deductions function
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
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  daily_rate DECIMAL(10,2),
  deduction_amount DECIMAL(10,2),
  is_office_holiday BOOLEAN,
  deduction_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_salary DECIMAL(10,2);
  v_daily_rate DECIMAL(10,2);
  v_month_start DATE;
  v_month_end DATE;
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
  
  -- If no salary found, try fallback
  IF v_base_salary IS NULL OR v_base_salary = 0 THEN
    SELECT es.base_salary INTO v_base_salary
    FROM public.employee_salaries es
    WHERE es.user_id = p_user_id
    ORDER BY es.effective_from DESC
    LIMIT 1;
  END IF;
  
  -- If still no salary, return empty
  IF v_base_salary IS NULL OR v_base_salary = 0 THEN
    RETURN;
  END IF;
  
  -- Calculate daily rate
  v_daily_rate := COALESCE(v_base_salary / v_days_in_month, 0);
  
  -- Return leaves with salary deduction information
  RETURN QUERY
  SELECT 
    l.id,
    l.user_id,
    l.leave_date,
    COALESCE(l.leave_type_name, 'Personal Leave') as leave_type_name,
    l.is_paid_leave,
    l.is_approved,
    l.approved_by,
    l.approved_at,
    l.created_at,
    l.notes,
    v_daily_rate as daily_rate,
    CASE 
      WHEN l.is_paid_leave = false AND l.is_approved = true 
        AND NOT EXISTS (
          SELECT 1 FROM public.company_holidays ch 
          WHERE ch.holiday_date = l.leave_date
        )
        AND EXTRACT(DOW FROM l.leave_date) != 0 THEN v_daily_rate
      ELSE 0
    END as deduction_amount,
    (EXISTS (
      SELECT 1 FROM public.company_holidays ch 
      WHERE ch.holiday_date = l.leave_date
    ) OR EXTRACT(DOW FROM l.leave_date) = 0) as is_office_holiday,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.company_holidays ch 
        WHERE ch.holiday_date = l.leave_date
      ) THEN COALESCE(
        (SELECT 'Office holiday - ' || ch.title || ' - no deduction' 
         FROM public.company_holidays ch 
         WHERE ch.holiday_date = l.leave_date 
         LIMIT 1),
        'Office holiday - no deduction'
      )
      WHEN EXTRACT(DOW FROM l.leave_date) = 0 THEN 'Sunday - no deduction'
      WHEN l.is_paid_leave = false AND l.is_approved = true THEN 'Unpaid leave deduction'
      ELSE 'No deduction'
    END as deduction_reason
  FROM public.leaves l
  WHERE l.user_id = p_user_id
    AND l.leave_date >= v_month_start
    AND l.leave_date <= v_month_end
  ORDER BY l.leave_date;
END;
$$;

-- 4. Create the get_employee_salary_payment function
CREATE OR REPLACE FUNCTION public.get_employee_salary_payment(
  p_user_id UUID,
  p_month DATE
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  profile_id UUID,
  payment_month DATE,
  base_salary DECIMAL(10,2),
  gross_salary DECIMAL(10,2),
  net_salary DECIMAL(10,2),
  leave_deductions DECIMAL(10,2),
  unpaid_leave_days INTEGER,
  deduction_percentage DECIMAL(5,2),
  is_paid BOOLEAN,
  payment_date DATE,
  payment_method TEXT,
  payment_reference TEXT,
  notes TEXT,
  processed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id,
    sp.user_id,
    sp.profile_id,
    sp.payment_month,
    sp.base_salary,
    sp.gross_salary,
    sp.net_salary,
    sp.leave_deductions,
    sp.unpaid_leave_days,
    sp.deduction_percentage,
    sp.is_paid,
    sp.payment_date,
    sp.payment_method,
    sp.payment_reference,
    sp.notes,
    sp.processed_by,
    sp.created_at,
    sp.updated_at
  FROM public.salary_payments sp
  WHERE sp.user_id = p_user_id
    AND sp.payment_month = DATE_TRUNC('month', p_month)::DATE
  ORDER BY sp.created_at DESC;
END;
$$;

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_employee_salary_summary(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_leaves_with_salary_deductions(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_salary_payment(UUID, DATE) TO authenticated;

-- 6. Insert sample data safely
DO $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_salary_exists BOOLEAN;
BEGIN
  -- Get user IDs
  SELECT id INTO v_user_id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1;
  SELECT id INTO v_profile_id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    -- Check if salary already exists
    SELECT EXISTS(
      SELECT 1 FROM public.employee_salaries 
      WHERE user_id = v_user_id AND effective_from = '2025-01-01'
    ) INTO v_salary_exists;
    
    -- Insert salary if it doesn't exist
    IF NOT v_salary_exists THEN
      INSERT INTO public.employee_salaries (user_id, profile_id, base_salary, effective_from, is_active) 
      VALUES (v_user_id, v_profile_id, 50000.00, '2025-01-01', true);
      
      RAISE NOTICE 'Salary inserted for user: %', v_user_id;
    ELSE
      RAISE NOTICE 'Salary already exists for user: %', v_user_id;
    END IF;
  ELSE
    RAISE NOTICE 'User sakshisaglotia@gmail.com not found';
  END IF;
END $$;

-- 7. Test the function
SELECT 
  'Testing RPC function' as test_name,
  *
FROM public.get_employee_salary_summary(
  (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1),
  '2025-10-01'
);
