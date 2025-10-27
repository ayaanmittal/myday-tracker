-- TEST LEAVE DEDUCTIONS PREVIEW CALCULATION
-- This script tests the fixed function with various scenarios

-- Step 1: Check current data in leaves table for October 2025
SELECT 
  'Leaves Data for October 2025' as info,
  user_id,
  leave_date,
  is_paid_leave,
  is_approved,
  leave_type
FROM public.leaves
WHERE leave_date >= '2025-10-01' AND leave_date <= '2025-10-31'
ORDER BY user_id, leave_date;

-- Step 2: Check employee salaries
SELECT 
  'Employee Salaries' as info,
  user_id,
  base_salary,
  is_active,
  effective_from,
  effective_to
FROM public.employee_salaries
WHERE is_active = true
ORDER BY base_salary DESC;

-- Step 3: Check work days configuration
SELECT 
  'Work Days Configuration' as info,
  user_id,
  monday,
  tuesday,
  wednesday,
  thursday,
  friday,
  saturday,
  sunday
FROM public.employee_work_days
ORDER BY user_id;

-- Step 4: Test the function for all employees with salaries
SELECT 
  'Leave Deductions for All Employees' as info,
  p.name as employee_name,
  p.id as user_id,
  es.base_salary,
  *
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON p.id = es.user_id AND es.is_active = true
WHERE es.base_salary IS NOT NULL
ORDER BY es.base_salary DESC;

-- Step 5: Test specific employees
SELECT 
  'Dolly Jhamb Leave Deductions' as info,
  *
FROM public.calculate_employee_leave_deductions(
  (SELECT id FROM public.profiles WHERE name = 'Dolly Jhamb' LIMIT 1),
  '2025-10-01'::DATE,
  100.00
);

SELECT 
  'Isha Sharma Leave Deductions' as info,
  *
FROM public.calculate_employee_leave_deductions(
  (SELECT id FROM public.profiles WHERE name = 'Isha Sharma' LIMIT 1),
  '2025-10-01'::DATE,
  100.00
);

SELECT 
  'Sakshi Saglotia Leave Deductions' as info,
  *
FROM public.calculate_employee_leave_deductions(
  (SELECT id FROM public.profiles WHERE name = 'Sakshi Saglotia' LIMIT 1),
  '2025-10-01'::DATE,
  100.00
);

SELECT 
  'Arjan Singh Leave Deductions' as info,
  *
FROM public.calculate_employee_leave_deductions(
  (SELECT id FROM public.profiles WHERE name = 'Arjan Singh' LIMIT 1),
  '2025-10-01'::DATE,
  100.00
);

-- Step 6: Test with different deduction percentages
SELECT 
  'Dolly Jhamb with 50% deduction' as info,
  *
FROM public.calculate_employee_leave_deductions(
  (SELECT id FROM public.profiles WHERE name = 'Dolly Jhamb' LIMIT 1),
  '2025-10-01'::DATE,
  50.00
);

SELECT 
  'Dolly Jhamb with 75% deduction' as info,
  *
FROM public.calculate_employee_leave_deductions(
  (SELECT id FROM public.profiles WHERE name = 'Dolly Jhamb' LIMIT 1),
  '2025-10-01'::DATE,
  75.00
);

-- Step 7: Check office holidays for October 2025
SELECT 
  'Office Holidays in October 2025' as info,
  holiday_date,
  title,
  created_by
FROM public.company_holidays
WHERE holiday_date >= '2025-10-01' AND holiday_date <= '2025-10-31'
ORDER BY holiday_date;

-- Step 8: Calculate work days for October 2025 (Mon-Sat)
SELECT 
  'Work Days Calculation for October 2025' as info,
  COUNT(*) as total_days,
  COUNT(CASE WHEN EXTRACT(DOW FROM day) BETWEEN 1 AND 6 THEN 1 END) as work_days,
  COUNT(CASE WHEN EXTRACT(DOW FROM day) = 0 THEN 1 END) as sundays
FROM generate_series('2025-10-01'::DATE, '2025-10-31'::DATE, '1 day'::INTERVAL) AS day;

-- Step 9: Show expected results
SELECT 
  'Expected Results Summary' as info,
  'October 2025 has 31 days total' as month_info,
  'Mon-Sat work days = 27 days' as work_days_info,
  'Expected daily rates:' as rates_info,
  'Dolly (₹5,000): ₹185.19' as dolly_rate,
  'Isha (₹5,000): ₹185.19' as isha_rate,
  'Sakshi (₹10,000): ₹370.37' as sakshi_rate,
  'Arjan (₹14,000): ₹518.52' as arjan_rate;