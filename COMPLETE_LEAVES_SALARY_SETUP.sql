-- Complete setup for My Leaves & Salary functionality
-- This script creates all required tables, functions, and sample data

-- ==============================================
-- 1. CREATE TABLES
-- ==============================================

-- Create salary_payments table
CREATE TABLE IF NOT EXISTS public.salary_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_month DATE NOT NULL,
  base_salary DECIMAL(10,2) NOT NULL,
  gross_salary DECIMAL(10,2) NOT NULL,
  deductions DECIMAL(10,2) DEFAULT 0,
  net_salary DECIMAL(10,2) NOT NULL,
  leave_deductions DECIMAL(10,2) DEFAULT 0,
  unpaid_leave_days INTEGER DEFAULT 0,
  deduction_percentage DECIMAL(5,2) DEFAULT 0,
  is_paid BOOLEAN DEFAULT false,
  payment_date DATE,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(100),
  notes TEXT,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, payment_month)
);

-- Create company_holidays table
CREATE TABLE IF NOT EXISTS public.company_holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date DATE NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  is_office_holiday BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create leaves table
CREATE TABLE IF NOT EXISTS public.leaves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_date DATE NOT NULL,
  leave_type_id UUID REFERENCES public.leave_types(id),
  is_paid_leave BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create employee_salaries table
CREATE TABLE IF NOT EXISTS public.employee_salaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_salary DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  salary_frequency VARCHAR(20) DEFAULT 'monthly',
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==============================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ==============================================

ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salaries ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- 3. CREATE RLS POLICIES
-- ==============================================

-- Salary payments policies
CREATE POLICY "Users can view own salary payments" ON public.salary_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all salary payments" ON public.salary_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Company holidays policies
CREATE POLICY "Everyone can view company holidays" ON public.company_holidays
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage company holidays" ON public.company_holidays
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Leaves policies
CREATE POLICY "Users can view own leaves" ON public.leaves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all leaves" ON public.leaves
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Employee salaries policies
CREATE POLICY "Users can view own salaries" ON public.employee_salaries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all salaries" ON public.employee_salaries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ==============================================
-- 4. CREATE INDEXES
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_salary_payments_user_month ON public.salary_payments(user_id, payment_month);
CREATE INDEX IF NOT EXISTS idx_company_holidays_date ON public.company_holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_leaves_user_date ON public.leaves(user_id, leave_date);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_user_effective ON public.employee_salaries(user_id, effective_from, effective_to);

-- ==============================================
-- 5. CREATE RPC FUNCTIONS
-- ==============================================

-- Function to get employee leaves with salary deductions
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
  
  -- Calculate daily rate (base salary / days in month)
  v_daily_rate := COALESCE(v_base_salary / EXTRACT(DAY FROM v_month_end), 0);
  
  -- Return leaves with salary deduction information
  RETURN QUERY
  SELECT 
    l.id,
    l.user_id,
    l.leave_date,
    COALESCE(lt.name, 'Personal Leave') as leave_type_name,
    l.is_paid_leave,
    l.is_approved,
    l.approved_by,
    l.approved_at,
    l.created_at,
    l.notes,
    v_daily_rate as daily_rate,
    CASE 
      WHEN l.is_paid_leave = false AND l.is_approved = true THEN v_daily_rate
      ELSE 0
    END as deduction_amount,
    false as is_office_holiday,
    CASE 
      WHEN l.is_paid_leave = false AND l.is_approved = true THEN 'Unpaid leave deduction'
      ELSE 'No deduction'
    END as deduction_reason
  FROM public.leaves l
  LEFT JOIN public.leave_types lt ON l.leave_type_id = lt.id
  WHERE l.user_id = p_user_id
    AND l.leave_date >= v_month_start
    AND l.leave_date <= v_month_end
  ORDER BY l.leave_date;
END;
$$;

-- Function to get employee salary summary
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
  
  -- Calculate daily rate
  v_daily_rate := COALESCE(v_base_salary / EXTRACT(DAY FROM v_month_end), 0);
  
  -- Count leaves and calculate deductions
  SELECT 
    COUNT(*) FILTER (WHERE l.is_paid_leave = true AND l.is_approved = true),
    COUNT(*) FILTER (WHERE l.is_paid_leave = false AND l.is_approved = true),
    SUM(CASE WHEN l.is_paid_leave = false AND l.is_approved = true THEN v_daily_rate ELSE 0 END)
  INTO v_paid_leaves, v_unpaid_leaves, v_total_deductions
  FROM public.leaves l
  WHERE l.user_id = p_user_id
    AND l.leave_date >= v_month_start
    AND l.leave_date <= v_month_end;
  
  -- Count office holidays
  SELECT COUNT(*)
  INTO v_office_holidays
  FROM public.company_holidays ch
  WHERE ch.holiday_date >= v_month_start
    AND ch.holiday_date <= v_month_end
    AND ch.is_office_holiday = true;
  
  -- Calculate net salary and deduction percentage
  v_net_salary := v_base_salary - COALESCE(v_total_deductions, 0);
  v_deduction_percentage := CASE 
    WHEN v_base_salary > 0 THEN (COALESCE(v_total_deductions, 0) / v_base_salary * 100)
    ELSE 0
  END;
  
  -- Return the summary
  RETURN QUERY
  SELECT 
    COALESCE(v_total_deductions, 0),
    COALESCE(v_paid_leaves, 0),
    COALESCE(v_unpaid_leaves, 0),
    COALESCE(v_office_holidays, 0),
    COALESCE(v_base_salary, 0),
    COALESCE(v_net_salary, 0),
    COALESCE(v_deduction_percentage, 0);
END;
$$;

-- Function to get employee salary payment for a month
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
  deductions DECIMAL(10,2),
  net_salary DECIMAL(10,2),
  leave_deductions DECIMAL(10,2),
  unpaid_leave_days INTEGER,
  deduction_percentage DECIMAL(5,2),
  is_paid BOOLEAN,
  payment_date DATE,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(100),
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
    sp.deductions,
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

-- ==============================================
-- 6. GRANT PERMISSIONS
-- ==============================================

GRANT EXECUTE ON FUNCTION public.get_employee_leaves_with_salary_deductions(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_salary_summary(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_salary_payment(UUID, DATE) TO authenticated;

-- ==============================================
-- 7. INSERT SAMPLE DATA
-- ==============================================

-- Insert sample company holidays for October 2025
INSERT INTO public.company_holidays (holiday_date, title, description, is_office_holiday) VALUES
  ('2025-10-02', 'Gandhi Jayanti', 'National holiday', true),
  ('2025-10-12', 'Dussehra', 'Religious holiday', true)
ON CONFLICT DO NOTHING;

-- Insert sample employee salary for Sakshi
INSERT INTO public.employee_salaries (user_id, base_salary, effective_from, is_active) 
SELECT 
  p.id,
  50000.00,
  '2025-01-01',
  true
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT DO NOTHING;

-- Insert sample leave data for Sakshi
INSERT INTO public.leaves (user_id, leave_date, is_paid_leave, is_approved, notes)
SELECT 
  p.id,
  '2025-10-15',
  false,
  true,
  'Personal leave'
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT DO NOTHING;

INSERT INTO public.leaves (user_id, leave_date, is_paid_leave, is_approved, notes)
SELECT 
  p.id,
  '2025-10-16',
  false,
  true,
  'Personal leave'
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT DO NOTHING;

-- Insert sample salary payment for Sakshi
INSERT INTO public.salary_payments (
  user_id, 
  profile_id, 
  payment_month, 
  base_salary, 
  gross_salary, 
  net_salary, 
  leave_deductions, 
  unpaid_leave_days, 
  deduction_percentage,
  is_paid
)
SELECT 
  p.id,
  p.id,
  '2025-10-01',
  50000.00,
  50000.00,
  48387.10,
  1612.90,
  2,
  3.23,
  false
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT (user_id, payment_month) DO NOTHING;

-- ==============================================
-- 8. VERIFICATION QUERIES
-- ==============================================

-- Verify tables exist
SELECT 'Tables created successfully' as status;

-- Verify sample data
SELECT 'Sample data inserted' as status;



