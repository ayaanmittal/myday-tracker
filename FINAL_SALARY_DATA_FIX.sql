-- Final comprehensive fix for salary data
-- This ensures all data is properly set up and the page shows correct values

-- 1. Ensure the user exists and get their ID
DO $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
BEGIN
  -- Get user and profile IDs
  SELECT id INTO v_user_id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1;
  SELECT id INTO v_profile_id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User sakshisaglotia@gmail.com not found';
  END IF;
  
  -- Insert/update employee salary
  INSERT INTO public.employee_salaries (user_id, profile_id, base_salary, effective_from, is_active) 
  VALUES (v_user_id, v_profile_id, 50000.00, '2025-01-01', true)
  ON CONFLICT (user_id, effective_from) DO UPDATE SET
    base_salary = EXCLUDED.base_salary,
    is_active = EXCLUDED.is_active;
    
  RAISE NOTICE 'Employee salary set to ₹50,000 for user %', v_user_id;
END $$;

-- 2. Ensure company holidays exist
INSERT INTO public.company_holidays (holiday_date, title, created_by) VALUES
  ('2025-10-02', 'Gandhi Jayanti', (SELECT id FROM auth.users LIMIT 1)),
  ('2025-10-12', 'Dussehra', (SELECT id FROM auth.users LIMIT 1)),
  ('2025-10-20', 'Diwali', (SELECT id FROM auth.users LIMIT 1)),
  ('2025-10-21', 'Diwali Holiday', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (holiday_date) DO UPDATE SET
  title = EXCLUDED.title;

-- 3. Insert comprehensive leave data for October 2025
-- This creates a realistic scenario with mixed leave types

-- Regular unpaid leaves (should be deducted)
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

-- 4. Test the RPC function to verify it works
SELECT 
  'Testing get_employee_salary_summary' as test_name,
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

-- 5. Test the leaves function
SELECT 
  'Testing get_employee_leaves_with_salary_deductions' as test_name,
  COUNT(*) as leave_count,
  SUM(deduction_amount) as total_deductions,
  COUNT(*) FILTER (WHERE is_office_holiday = true) as office_holiday_count
FROM public.get_employee_leaves_with_salary_deductions(
  (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1),
  '2025-10-01'
);

-- 6. Show expected results
SELECT 
  'Expected Results' as test_name,
  'Base Salary: ₹50,000' as base_salary,
  'Unpaid Leaves: 8 days (Oct 15-19, 22-25)' as unpaid_leaves,
  'Office Holidays: 4 days (Oct 2, 12, 20, 21)' as office_holidays,
  'Daily Rate: ₹1,612.90 (₹50,000 ÷ 31 days)' as daily_rate,
  'Total Deductions: ₹12,903.20 (8 days × ₹1,612.90)' as total_deductions,
  'Net Salary: ₹37,096.80 (₹50,000 - ₹12,903.20)' as net_salary,
  'Deduction %: 25.81%' as deduction_percentage;



