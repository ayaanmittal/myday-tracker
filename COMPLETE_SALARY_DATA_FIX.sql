-- Complete fix for salary data fetching issues
-- This ensures all RPC functions exist and work properly

-- 1. First, ensure all required tables exist
CREATE TABLE IF NOT EXISTS public.employee_salaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_salary DECIMAL(10,2) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.salary_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_month DATE NOT NULL,
  base_salary DECIMAL(10,2) NOT NULL,
  gross_salary DECIMAL(10,2) NOT NULL,
  net_salary DECIMAL(10,2) NOT NULL,
  leave_deductions DECIMAL(10,2) DEFAULT 0,
  unpaid_leave_days INTEGER DEFAULT 0,
  deduction_percentage DECIMAL(5,2) DEFAULT 0,
  is_paid BOOLEAN DEFAULT false,
  payment_date DATE,
  payment_method TEXT,
  payment_reference TEXT,
  notes TEXT,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, payment_month)
);

CREATE TABLE IF NOT EXISTS public.company_holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  title TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create or replace the get_employee_salary_summary function
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
BEGIN
  -- Get the month boundaries
  v_month_start := DATE_TRUNC('month', p_month)::DATE;
  v_month_end := (DATE_TRUNC('month', p_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Get employee's base salary for the month
  SELECT es.base_salary INTO v_base_salary
  FROM public.employee_salaries es
  WHERE es.user_id = p_user_id
    AND es.is_active = true
    AND es.effective_from <= v_month_end
    AND (es.effective_to IS NULL OR es.effective_to >= v_month_start)
  ORDER BY es.effective_from DESC
  LIMIT 1;
  
  -- If no salary found, return zeros
  IF v_base_salary IS NULL OR v_base_salary = 0 THEN
    RETURN QUERY SELECT 0.00, 0, 0, 0, 0.00, 0.00, 0.00;
    RETURN;
  END IF;
  
  -- Calculate daily rate
  v_daily_rate := COALESCE(v_base_salary / EXTRACT(DAY FROM v_month_end), 0);
  
  -- Count total office holidays in the month (including Sundays)
  WITH all_holidays AS (
    -- Company holidays
    SELECT ch.holiday_date as holiday_date
    FROM public.company_holidays ch
    WHERE ch.holiday_date >= v_month_start
      AND ch.holiday_date <= v_month_end
    
    UNION
    
    -- Sundays
    SELECT generate_series(v_month_start, v_month_end, '1 day'::interval)::date as holiday_date
    WHERE EXTRACT(DOW FROM generate_series(v_month_start, v_month_end, '1 day'::interval)) = 0
  )
  SELECT COUNT(DISTINCT holiday_date)
  INTO v_office_holidays
  FROM all_holidays;
  
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

-- 3. Create or replace the get_employee_leaves_with_salary_deductions function
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
BEGIN
  -- Get the month boundaries
  v_month_start := DATE_TRUNC('month', p_month)::DATE;
  v_month_end := (DATE_TRUNC('month', p_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Get employee's base salary for the month
  SELECT es.base_salary INTO v_base_salary
  FROM public.employee_salaries es
  WHERE es.user_id = p_user_id
    AND es.is_active = true
    AND es.effective_from <= v_month_end
    AND (es.effective_to IS NULL OR es.effective_to >= v_month_start)
  ORDER BY es.effective_from DESC
  LIMIT 1;
  
  -- If no salary found, return empty
  IF v_base_salary IS NULL OR v_base_salary = 0 THEN
    RETURN;
  END IF;
  
  -- Calculate daily rate
  v_daily_rate := COALESCE(v_base_salary / EXTRACT(DAY FROM v_month_end), 0);
  
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

-- 4. Create or replace the get_employee_salary_payment function
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

-- 6. Insert sample data if it doesn't exist
INSERT INTO public.employee_salaries (user_id, profile_id, base_salary, effective_from, is_active) 
SELECT 
  p.id,
  p.id,
  50000.00,
  '2025-01-01',
  true
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT DO NOTHING;

-- Insert company holidays
INSERT INTO public.company_holidays (holiday_date, title, created_by) VALUES
  ('2025-10-02', 'Gandhi Jayanti', (SELECT id FROM auth.users LIMIT 1)),
  ('2025-10-12', 'Dussehra', (SELECT id FROM auth.users LIMIT 1)),
  ('2025-10-20', 'Diwali', (SELECT id FROM auth.users LIMIT 1)),
  ('2025-10-21', 'Diwali Holiday', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (holiday_date) DO UPDATE SET
  title = EXCLUDED.title;

-- Insert sample leaves
INSERT INTO public.leaves (user_id, profile_id, leave_date, leave_type_name, is_paid_leave, is_approved, notes)
SELECT 
  p.id,
  p.id,
  '2025-10-15',
  'Personal Leave',
  false,
  true,
  'Personal leave'
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT DO NOTHING;

INSERT INTO public.leaves (user_id, profile_id, leave_date, leave_type_name, is_paid_leave, is_approved, notes)
SELECT 
  p.id,
  p.id,
  '2025-10-16',
  'Personal Leave',
  false,
  true,
  'Personal leave'
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT DO NOTHING;

INSERT INTO public.leaves (user_id, profile_id, leave_date, leave_type_name, is_paid_leave, is_approved, notes)
SELECT 
  p.id,
  p.id,
  '2025-10-20',
  'Personal Leave',
  false,
  true,
  'Personal leave - overlaps with Diwali'
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT DO NOTHING;
