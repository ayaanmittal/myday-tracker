-- DEBUG LEAVE DEDUCTIONS SCRIPT
-- This will help us understand what's wrong with the calculation

-- Step 1: Check Dolly Jhamb's specific data
SELECT 'Dolly Jhamb specific data:' as step;
SELECT 
  p.name,
  p.user_id,
  es.base_salary,
  es.effective_from,
  es.effective_to,
  ewd.monday,
  ewd.tuesday,
  ewd.wednesday,
  ewd.thursday,
  ewd.friday,
  ewd.saturday,
  ewd.sunday
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
LEFT JOIN public.employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.name ILIKE '%dolly%'
ORDER BY p.name;

-- Step 2: Check Dolly's leave records for October 2025
SELECT 'Dolly Jhamb leave records for October 2025:' as step;
SELECT 
  p.name,
  l.leave_date,
  l.leave_type_name,
  l.is_paid_leave,
  l.is_approved,
  l.notes
FROM public.profiles p
JOIN public.leaves l ON l.user_id = p.user_id
WHERE p.name ILIKE '%dolly%'
  AND l.leave_date >= '2025-10-01' 
  AND l.leave_date < '2025-11-01'
ORDER BY p.name, l.leave_date;

-- Step 3: Check work days calculation for October 2025
SELECT 'Work days calculation for October 2025:' as step;
SELECT 
  p.name,
  ewd.monday,
  ewd.tuesday,
  ewd.wednesday,
  ewd.thursday,
  ewd.friday,
  ewd.saturday,
  ewd.sunday,
  -- Calculate work days per week
  (CASE WHEN ewd.monday = true THEN 1 ELSE 0 END +
   CASE WHEN ewd.tuesday = true THEN 1 ELSE 0 END +
   CASE WHEN ewd.wednesday = true THEN 1 ELSE 0 END +
   CASE WHEN ewd.thursday = true THEN 1 ELSE 0 END +
   CASE WHEN ewd.friday = true THEN 1 ELSE 0 END +
   CASE WHEN ewd.saturday = true THEN 1 ELSE 0 END +
   CASE WHEN ewd.sunday = true THEN 1 ELSE 0 END) as work_days_per_week
FROM public.profiles p
LEFT JOIN public.employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.name ILIKE '%dolly%'
ORDER BY p.name;

-- Step 4: Manual work days calculation for October 2025
SELECT 'Manual work days calculation for October 2025:' as step;
WITH october_days AS (
  SELECT generate_series('2025-10-01'::DATE, '2025-10-31'::DATE, '1 day'::interval)::DATE as day_date
),
work_days_count AS (
  SELECT 
    COUNT(*) as total_days,
    COUNT(*) FILTER (WHERE EXTRACT(DOW FROM day_date) IN (1,2,3,4,5,6)) as mon_sat_days,
    COUNT(*) FILTER (WHERE EXTRACT(DOW FROM day_date) IN (1,2,3,4,5)) as mon_fri_days
  FROM october_days
)
SELECT 
  'October 2025' as month,
  total_days,
  mon_sat_days,
  mon_fri_days
FROM work_days_count;

-- Step 5: Test daily rate calculation for Dolly
SELECT 'Daily rate calculation for Dolly Jhamb:' as step;
SELECT 
  p.name,
  es.base_salary,
  public.calculate_daily_salary_rate(p.user_id, '2025-10-01'::DATE) as daily_rate
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
WHERE p.name ILIKE '%dolly%'
ORDER BY p.name;

-- Step 6: Test unpaid leave calculation for Dolly
SELECT 'Unpaid leave calculation for Dolly Jhamb:' as step;
SELECT 
  p.name,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2025-10-01'::DATE) as unpaid_days
FROM public.profiles p
WHERE p.name ILIKE '%dolly%'
ORDER BY p.name;

-- Step 7: Test complete leave deduction calculation for Dolly
SELECT 'Complete leave deduction calculation for Dolly Jhamb:' as step;
SELECT 
  p.name,
  es.base_salary,
  public.calculate_daily_salary_rate(p.user_id, '2025-10-01'::DATE) as daily_rate,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2025-10-01'::DATE) as unpaid_days,
  public.calculate_month_leave_deductions(p.user_id, '2025-10-01'::DATE) as deduction_calculation
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
WHERE p.name ILIKE '%dolly%'
ORDER BY p.name;

-- Step 8: Check all employees' work days configuration
SELECT 'All employees work days configuration:' as step;
SELECT 
  p.name,
  ewd.monday,
  ewd.tuesday,
  ewd.wednesday,
  ewd.thursday,
  ewd.friday,
  ewd.saturday,
  ewd.sunday,
  (CASE WHEN ewd.monday = true THEN 1 ELSE 0 END +
   CASE WHEN ewd.tuesday = true THEN 1 ELSE 0 END +
   CASE WHEN ewd.wednesday = true THEN 1 ELSE 0 END +
   CASE WHEN ewd.thursday = true THEN 1 ELSE 0 END +
   CASE WHEN ewd.friday = true THEN 1 ELSE 0 END +
   CASE WHEN ewd.saturday = true THEN 1 ELSE 0 END +
   CASE WHEN ewd.sunday = true THEN 1 ELSE 0 END) as work_days_per_week
FROM public.profiles p
LEFT JOIN public.employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.is_active = true
ORDER BY p.name;

-- Step 9: Check if functions exist and work
SELECT 'Check if functions exist:' as step;
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_name IN (
  'calculate_daily_salary_rate',
  'calculate_unpaid_leave_days_for_salary',
  'calculate_month_leave_deductions'
)
  AND routine_schema = 'public';

