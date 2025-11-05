-- Insert sample data for My Leaves & Salary functionality
-- This will populate the existing tables with test data

-- 1. Insert sample company holidays for October 2025
INSERT INTO public.company_holidays (holiday_date, title, created_by) VALUES
  ('2025-10-02', 'Gandhi Jayanti', (SELECT id FROM auth.users LIMIT 1)),
  ('2025-10-12', 'Dussehra', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (holiday_date) DO NOTHING;

-- 2. Insert sample employee salary for Sakshi (if not exists)
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

-- 3. Insert sample leave data for Sakshi
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

-- 4. Insert sample salary payment for Sakshi
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

-- 5. Insert sample leave types if they don't exist
INSERT INTO public.leave_types (name, description, max_days_per_year, is_paid, requires_approval, is_active) VALUES
  ('Personal Leave', 'Personal leave without pay', 0, false, true, true),
  ('Sick Leave', 'Sick leave with pay', 12, true, true, true),
  ('Annual Leave', 'Annual vacation leave', 21, true, true, true)
ON CONFLICT DO NOTHING;



