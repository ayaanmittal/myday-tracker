-- Ensure all required tables and sample data exist
-- This will create missing tables and insert sample data

-- 1. Create employee_salaries table if it doesn't exist
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

-- 2. Create salary_payments table if it doesn't exist
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

-- 3. Create company_holidays table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.company_holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  title TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Insert sample employee salary
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

-- 5. Insert company holidays
INSERT INTO public.company_holidays (holiday_date, title, created_by) VALUES
  ('2025-10-02', 'Gandhi Jayanti', (SELECT id FROM auth.users LIMIT 1)),
  ('2025-10-12', 'Dussehra', (SELECT id FROM auth.users LIMIT 1)),
  ('2025-10-20', 'Diwali', (SELECT id FROM auth.users LIMIT 1)),
  ('2025-10-21', 'Diwali Holiday', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (holiday_date) DO UPDATE SET
  title = EXCLUDED.title;

-- 6. Insert sample leaves
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

INSERT INTO public.leaves (user_id, profile_id, leave_date, leave_type_name, is_paid_leave, is_approved, notes)
SELECT 
  p.id,
  p.id,
  '2025-10-25',
  'Personal Leave',
  false,
  true,
  'Personal leave'
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT DO NOTHING;

-- 7. Insert sample salary payment
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
  48387.10,  -- 50000 - 1612.90
  1612.90,   -- 1 day * 1612.90
  1,         -- 1 net unpaid day
  3.23,      -- 1612.90 / 50000 * 100
  false
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT (user_id, payment_month) DO UPDATE SET
  net_salary = EXCLUDED.net_salary,
  leave_deductions = EXCLUDED.leave_deductions,
  unpaid_leave_days = EXCLUDED.unpaid_leave_days,
  deduction_percentage = EXCLUDED.deduction_percentage;
