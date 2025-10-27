-- Insert enhanced sample data to demonstrate office holiday logic
-- This creates a realistic scenario with office holidays and overlapping leaves

-- 1. Insert more company holidays for October 2025
INSERT INTO public.company_holidays (holiday_date, title, created_by) VALUES
  ('2025-10-02', 'Gandhi Jayanti', (SELECT id FROM auth.users LIMIT 1)),
  ('2025-10-12', 'Dussehra', (SELECT id FROM auth.users LIMIT 1)),
  ('2025-10-20', 'Diwali', (SELECT id FROM auth.users LIMIT 1)),
  ('2025-10-21', 'Diwali Holiday', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (holiday_date) DO UPDATE SET
  title = EXCLUDED.title;

-- 2. Insert employee salary for Sakshi (if not exists)
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

-- 3. Insert realistic leave data for Sakshi
-- Personal leave that overlaps with office holiday (should not be deducted)
INSERT INTO public.leaves (user_id, profile_id, leave_date, leave_type_name, is_paid_leave, is_approved, notes)
SELECT 
  p.id,
  p.id,
  '2025-10-01',
  'Personal Leave',
  false,
  true,
  'Personal leave - overlaps with Gandhi Jayanti'
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT DO NOTHING;

-- Regular unpaid leave (should be deducted)
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

-- Leave that overlaps with Diwali (should not be deducted)
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

-- Leave on Sunday (should not be deducted)
INSERT INTO public.leaves (user_id, profile_id, leave_date, leave_type_name, is_paid_leave, is_approved, notes)
SELECT 
  p.id,
  p.id,
  '2025-10-05', -- This is a Sunday
  'Personal Leave',
  false,
  true,
  'Personal leave - Sunday (no deduction)'
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT DO NOTHING;

-- Another leave on Sunday (should not be deducted)
INSERT INTO public.leaves (user_id, profile_id, leave_date, leave_type_name, is_paid_leave, is_approved, notes)
SELECT 
  p.id,
  p.id,
  '2025-10-19', -- This is a Sunday
  'Personal Leave',
  false,
  true,
  'Personal leave - Sunday (no deduction)'
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT DO NOTHING;

-- Regular unpaid leave (should be deducted)
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

INSERT INTO public.leaves (user_id, profile_id, leave_date, leave_type_name, is_paid_leave, is_approved, notes)
SELECT 
  p.id,
  p.id,
  '2025-10-26',
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
  '2025-10-27',
  'Personal Leave',
  false,
  true,
  'Personal leave'
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT DO NOTHING;

-- 4. Insert salary payment with correct calculations
-- Expected: 7 total leave days - 4 office holidays (Oct 2, 20) - 2 Sundays (Oct 5, 19) = 1 net unpaid day
-- Daily rate: 50000/31 = 1612.90
-- Total deduction: 1 * 1612.90 = 1612.90
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
  1,         -- 1 net unpaid day (7 total - 4 office holidays - 2 Sundays)
  3.23,      -- 1612.90 / 50000 * 100
  false
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT (user_id, payment_month) DO UPDATE SET
  net_salary = EXCLUDED.net_salary,
  leave_deductions = EXCLUDED.leave_deductions,
  unpaid_leave_days = EXCLUDED.unpaid_leave_days,
  deduction_percentage = EXCLUDED.deduction_percentage;
