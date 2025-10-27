-- Create comprehensive salary management system
-- This includes salary records, leave deductions, and payroll analytics

-- Step 1: Create employee_salaries table for base salary information
CREATE TABLE IF NOT EXISTS public.employee_salaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_salary NUMERIC(12,2) NOT NULL CHECK (base_salary >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  salary_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (salary_frequency IN ('monthly', 'weekly', 'daily')),
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT check_effective_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Step 2: Create salary_payments table for monthly salary payments
CREATE TABLE IF NOT EXISTS public.salary_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_month DATE NOT NULL, -- First day of the month
  base_salary NUMERIC(12,2) NOT NULL,
  gross_salary NUMERIC(12,2) NOT NULL,
  deductions NUMERIC(12,2) DEFAULT 0,
  net_salary NUMERIC(12,2) NOT NULL,
  leave_deductions NUMERIC(12,2) DEFAULT 0,
  unpaid_leave_days INTEGER DEFAULT 0,
  deduction_percentage NUMERIC(5,2) DEFAULT 0,
  is_paid BOOLEAN DEFAULT false,
  payment_date DATE,
  payment_method TEXT,
  payment_reference TEXT,
  notes TEXT,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT check_salary_amounts CHECK (
    gross_salary >= 0 AND 
    deductions >= 0 AND 
    net_salary >= 0 AND 
    leave_deductions >= 0 AND
    deduction_percentage >= 0 AND 
    deduction_percentage <= 100
  )
);

-- Step 3: Create leave_deductions table for tracking leave-based salary cuts
CREATE TABLE IF NOT EXISTS public.leave_deductions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  salary_payment_id UUID NOT NULL REFERENCES public.salary_payments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_date DATE NOT NULL,
  leave_type TEXT NOT NULL,
  is_paid_leave BOOLEAN DEFAULT false,
  deduction_amount NUMERIC(12,2) DEFAULT 0,
  daily_salary_rate NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_salaries_user_id ON public.employee_salaries(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_profile_id ON public.employee_salaries(profile_id);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_effective_from ON public.employee_salaries(effective_from);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_is_active ON public.employee_salaries(is_active);

CREATE INDEX IF NOT EXISTS idx_salary_payments_user_id ON public.salary_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_profile_id ON public.salary_payments(profile_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_payment_month ON public.salary_payments(payment_month);
CREATE INDEX IF NOT EXISTS idx_salary_payments_is_paid ON public.salary_payments(is_paid);

CREATE INDEX IF NOT EXISTS idx_leave_deductions_salary_payment_id ON public.leave_deductions(salary_payment_id);
CREATE INDEX IF NOT EXISTS idx_leave_deductions_user_id ON public.leave_deductions(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_deductions_leave_date ON public.leave_deductions(leave_date);

-- Step 5: Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS ux_employee_salaries_user_effective 
ON public.employee_salaries(user_id, effective_from) 
WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS ux_salary_payments_user_month 
ON public.salary_payments(user_id, payment_month);

-- Step 6: Enable RLS
ALTER TABLE public.employee_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_deductions ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies for employee_salaries
CREATE POLICY "Users can view own salary" ON public.employee_salaries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all salaries" ON public.employee_salaries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Step 8: Create RLS policies for salary_payments
CREATE POLICY "Users can view own salary payments" ON public.salary_payments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all salary payments" ON public.salary_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Step 9: Create RLS policies for leave_deductions
CREATE POLICY "Users can view own leave deductions" ON public.leave_deductions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all leave deductions" ON public.leave_deductions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Step 10: Create function to calculate daily salary rate
CREATE OR REPLACE FUNCTION calculate_daily_salary_rate(
  p_user_id UUID,
  p_payment_month DATE
)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
AS $$
DECLARE
  v_base_salary NUMERIC(12,2);
  v_days_in_month INTEGER;
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
  
  -- Calculate days in the month
  v_days_in_month := EXTRACT(DAY FROM (p_payment_month + INTERVAL '1 month' - INTERVAL '1 day'));
  
  -- Return daily rate
  RETURN COALESCE(v_base_salary / v_days_in_month, 0);
END;
$$;

-- Step 11: Create function to calculate leave deductions for a month
CREATE OR REPLACE FUNCTION calculate_month_leave_deductions(
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

-- Step 12: Create function to generate monthly salary payments
CREATE OR REPLACE FUNCTION generate_monthly_salary_payments(
  p_payment_month DATE,
  p_processed_by UUID DEFAULT NULL
)
RETURNS TABLE(
  user_id UUID,
  profile_id UUID,
  employee_name TEXT,
  base_salary NUMERIC(12,2),
  gross_salary NUMERIC(12,2),
  leave_deductions NUMERIC(12,2),
  unpaid_leave_days INTEGER,
  net_salary NUMERIC(12,2),
  payment_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_record RECORD;
  v_leave_deduction RECORD;
  v_payment_id UUID;
BEGIN
  -- Loop through all active employees
  FOR v_user_record IN
    SELECT 
      p.id as profile_id,
      p.user_id,
      p.name as employee_name,
      es.base_salary
    FROM public.profiles p
    JOIN public.employee_salaries es ON es.profile_id = p.id
    WHERE p.is_active = true
      AND es.is_active = true
      AND es.effective_from <= p_payment_month
      AND (es.effective_to IS NULL OR es.effective_to >= p_payment_month)
  LOOP
    -- Calculate leave deductions
    SELECT * INTO v_leave_deduction
    FROM calculate_month_leave_deductions(v_user_record.user_id, p_payment_month);
    
    -- Create salary payment record
    INSERT INTO public.salary_payments (
      user_id,
      profile_id,
      payment_month,
      base_salary,
      gross_salary,
      leave_deductions,
      unpaid_leave_days,
      deduction_percentage,
      net_salary,
      processed_by
    ) VALUES (
      v_user_record.user_id,
      v_user_record.profile_id,
      p_payment_month,
      v_user_record.base_salary,
      v_user_record.base_salary,
      COALESCE(v_leave_deduction.total_deduction_amount, 0),
      COALESCE(v_leave_deduction.total_unpaid_days, 0),
      CASE 
        WHEN v_user_record.base_salary > 0 THEN 
          (COALESCE(v_leave_deduction.total_deduction_amount, 0) / v_user_record.base_salary * 100)
        ELSE 0 
      END,
      v_user_record.base_salary - COALESCE(v_leave_deduction.total_deduction_amount, 0),
      p_processed_by
    )
    RETURNING id INTO v_payment_id;
    
    -- Return the generated payment info
    RETURN QUERY SELECT
      v_user_record.user_id,
      v_user_record.profile_id,
      v_user_record.employee_name,
      v_user_record.base_salary,
      v_user_record.base_salary,
      COALESCE(v_leave_deduction.total_deduction_amount, 0),
      COALESCE(v_leave_deduction.total_unpaid_days, 0),
      v_user_record.base_salary - COALESCE(v_leave_deduction.total_deduction_amount, 0),
      v_payment_id;
  END LOOP;
END;
$$;

-- Step 13: Create function to get payroll analytics
CREATE OR REPLACE FUNCTION get_payroll_analytics(
  p_start_month DATE DEFAULT CURRENT_DATE - INTERVAL '12 months',
  p_end_month DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  total_employees BIGINT,
  total_payroll_outflow NUMERIC(12,2),
  average_salary NUMERIC(12,2),
  highest_paid_employee TEXT,
  highest_salary NUMERIC(12,2),
  total_leave_deductions NUMERIC(12,2),
  average_deduction_percentage NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH payroll_summary AS (
    SELECT 
      COUNT(DISTINCT sp.user_id) as employee_count,
      SUM(sp.net_salary) as total_payroll,
      AVG(sp.net_salary) as avg_salary,
      SUM(sp.leave_deductions) as total_deductions,
      AVG(sp.deduction_percentage) as avg_deduction_pct
    FROM public.salary_payments sp
    WHERE sp.payment_month BETWEEN p_start_month AND p_end_month
      AND sp.is_paid = true
  ),
  highest_paid AS (
    SELECT 
      p.name as employee_name,
      sp.net_salary
    FROM public.salary_payments sp
    JOIN public.profiles p ON p.id = sp.profile_id
    WHERE sp.payment_month BETWEEN p_start_month AND p_end_month
      AND sp.is_paid = true
    ORDER BY sp.net_salary DESC
    LIMIT 1
  )
  SELECT 
    ps.employee_count,
    ps.total_payroll,
    ps.avg_salary,
    COALESCE(hp.employee_name, 'N/A'),
    COALESCE(hp.net_salary, 0),
    ps.total_deductions,
    ps.avg_deduction_pct
  FROM payroll_summary ps
  CROSS JOIN LATERAL (
    SELECT employee_name, net_salary FROM highest_paid
  ) hp;
END;
$$;

-- Step 14: Create function to update salary payment status
CREATE OR REPLACE FUNCTION update_salary_payment_status(
  p_payment_id UUID,
  p_is_paid BOOLEAN,
  p_payment_date DATE DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_updated_by UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.salary_payments
  SET 
    is_paid = p_is_paid,
    payment_date = CASE WHEN p_is_paid THEN COALESCE(p_payment_date, CURRENT_DATE) ELSE NULL END,
    payment_method = p_payment_method,
    payment_reference = p_payment_reference,
    notes = p_notes,
    updated_at = now()
  WHERE id = p_payment_id;
  
  RETURN FOUND;
END;
$$;

-- Step 15: Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_employee_salaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_salary_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_employee_salaries_updated_at
  BEFORE UPDATE ON public.employee_salaries
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_salaries_updated_at();

CREATE TRIGGER trigger_update_salary_payments_updated_at
  BEFORE UPDATE ON public.salary_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_salary_payments_updated_at();
