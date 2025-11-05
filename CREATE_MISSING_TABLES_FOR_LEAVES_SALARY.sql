-- Create missing tables for My Leaves & Salary functionality
-- This script creates the required tables and functions

-- 1. Create salary_payments table
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

-- 2. Create company_holidays table
CREATE TABLE IF NOT EXISTS public.company_holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date DATE NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  is_office_holiday BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Create leaves table (if not exists)
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

-- 4. Create employee_salaries table (if not exists)
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

-- 5. Enable Row Level Security
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salaries ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for salary_payments
CREATE POLICY "Users can view own salary payments" ON public.salary_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all salary payments" ON public.salary_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 7. Create RLS policies for company_holidays
CREATE POLICY "Everyone can view company holidays" ON public.company_holidays
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage company holidays" ON public.company_holidays
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 8. Create RLS policies for leaves
CREATE POLICY "Users can view own leaves" ON public.leaves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all leaves" ON public.leaves
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 9. Create RLS policies for employee_salaries
CREATE POLICY "Users can view own salaries" ON public.employee_salaries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all salaries" ON public.employee_salaries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 10. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_salary_payments_user_month ON public.salary_payments(user_id, payment_month);
CREATE INDEX IF NOT EXISTS idx_company_holidays_date ON public.company_holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_leaves_user_date ON public.leaves(user_id, leave_date);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_user_effective ON public.employee_salaries(user_id, effective_from, effective_to);

-- 11. Insert sample data for testing
INSERT INTO public.company_holidays (holiday_date, title, description, is_office_holiday) VALUES
  ('2025-10-02', 'Gandhi Jayanti', 'National holiday', true),
  ('2025-10-12', 'Dussehra', 'Religious holiday', true)
ON CONFLICT DO NOTHING;

-- 12. Insert sample employee salary
INSERT INTO public.employee_salaries (user_id, base_salary, effective_from, is_active) 
SELECT 
  p.id,
  50000.00,
  '2025-01-01',
  true
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT DO NOTHING;

-- 13. Insert sample leave data
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

-- 14. Insert sample salary payment
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



