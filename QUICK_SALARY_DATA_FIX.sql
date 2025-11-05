-- Quick fix to ensure salary data is properly set up
-- This will insert/update the employee salary data

-- 1. First, check if the user exists
SELECT 
  'User check' as test_name,
  id,
  email,
  full_name
FROM public.profiles 
WHERE email = 'sakshisaglotia@gmail.com';

-- 2. Insert/update employee salary
INSERT INTO public.employee_salaries (user_id, profile_id, base_salary, effective_from, is_active) 
SELECT 
  p.id,
  p.id,
  50000.00,
  '2025-01-01',
  true
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT (user_id, effective_from) DO UPDATE SET
  base_salary = EXCLUDED.base_salary,
  is_active = EXCLUDED.is_active;

-- 3. Verify the salary was inserted
SELECT 
  'Salary check' as test_name,
  base_salary,
  effective_from,
  is_active
FROM public.employee_salaries 
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1);

-- 4. Test the RPC function directly
SELECT 
  'RPC Test' as test_name,
  *
FROM public.get_employee_salary_summary(
  (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1),
  '2025-10-01'
);

-- 5. Insert more sample leaves to test the calculation
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
  '2025-10-17',
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
  '2025-10-18',
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
  '2025-10-19',
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
  '2025-10-21',
  'Personal Leave',
  false,
  true,
  'Personal leave - overlaps with Diwali Holiday'
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT DO NOTHING;

INSERT INTO public.leaves (user_id, profile_id, leave_date, leave_type_name, is_paid_leave, is_approved, notes)
SELECT 
  p.id,
  p.id,
  '2025-10-22',
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
  '2025-10-23',
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
  '2025-10-24',
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
  '2025-10-25',
  'Personal Leave',
  false,
  true,
  'Personal leave'
FROM public.profiles p 
WHERE p.email = 'sakshisaglotia@gmail.com'
ON CONFLICT DO NOTHING;

-- 6. Test the RPC function again after inserting data
SELECT 
  'Final RPC Test' as test_name,
  *
FROM public.get_employee_salary_summary(
  (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1),
  '2025-10-01'
);



