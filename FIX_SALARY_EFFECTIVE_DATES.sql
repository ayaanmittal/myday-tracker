-- FIX SALARY EFFECTIVE DATES SCRIPT
-- This will update salary effective dates to fix daily rate calculations

-- Step 1: Check current salary effective dates
SELECT 'Current salary effective dates:' as step;
SELECT 
  p.name,
  es.base_salary,
  es.is_active as salary_active,
  es.effective_from,
  es.effective_to
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
WHERE p.is_active = true
  AND es.base_salary IS NOT NULL
  AND es.base_salary > 0
ORDER BY p.name;

-- Step 2: Update Dolly Jhamb's salary effective date
UPDATE public.employee_salaries 
SET effective_from = '2025-10-01'
WHERE user_id = (
  SELECT user_id FROM public.profiles WHERE name ILIKE '%dolly%'
)
AND is_active = true;

-- Step 3: Update Isha Sharma's salary effective date
UPDATE public.employee_salaries 
SET effective_from = '2025-10-01'
WHERE user_id = (
  SELECT user_id FROM public.profiles WHERE name ILIKE '%isha%'
)
AND is_active = true;

-- Step 4: Check updated salary effective dates
SELECT 'Updated salary effective dates:' as step;
SELECT 
  p.name,
  es.base_salary,
  es.is_active as salary_active,
  es.effective_from,
  es.effective_to
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
WHERE p.is_active = true
  AND es.base_salary IS NOT NULL
  AND es.base_salary > 0
ORDER BY p.name;

-- Step 5: Test daily rate calculation after fix
SELECT 'Daily rate calculation after fix:' as step;
SELECT 
  p.name,
  es.base_salary,
  es.effective_from,
  public.calculate_daily_salary_rate(p.user_id, '2025-10-01'::DATE) as daily_rate
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
WHERE p.is_active = true
  AND es.base_salary IS NOT NULL
  AND es.base_salary > 0
ORDER BY p.name;

-- Step 6: Test complete leave deduction calculation after fix
SELECT 'Complete leave deduction calculation after fix:' as step;
SELECT 
  p.name,
  es.base_salary,
  public.calculate_daily_salary_rate(p.user_id, '2025-10-01'::DATE) as daily_rate,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2025-10-01'::DATE) as unpaid_days,
  public.calculate_month_leave_deductions(p.user_id, '2025-10-01'::DATE) as deduction_calculation
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
WHERE p.is_active = true
ORDER BY p.name;

