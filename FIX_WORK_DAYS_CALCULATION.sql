-- FIX WORK DAYS CALCULATION SCRIPT
-- This will fix the work days calculation issue

-- Step 1: Check current work days configuration
SELECT 'Current work days configuration:' as step;
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

-- Step 2: Check October 2025 work days calculation
SELECT 'October 2025 work days calculation:' as step;
WITH october_days AS (
  SELECT generate_series('2025-10-01'::DATE, '2025-10-31'::DATE, '1 day'::interval)::DATE as day_date
),
work_days_count AS (
  SELECT 
    COUNT(*) as total_days,
    COUNT(*) FILTER (WHERE EXTRACT(DOW FROM day_date) IN (1,2,3,4,5,6)) as mon_sat_days,
    COUNT(*) FILTER (WHERE EXTRACT(DOW FROM day_date) IN (1,2,3,4,5)) as mon_fri_days,
    COUNT(*) FILTER (WHERE EXTRACT(DOW FROM day_date) = 0) as sundays,
    COUNT(*) FILTER (WHERE EXTRACT(DOW FROM day_date) = 6) as saturdays
  FROM october_days
)
SELECT 
  'October 2025' as month,
  total_days,
  mon_sat_days,
  mon_fri_days,
  sundays,
  saturdays
FROM work_days_count;

-- Step 3: Check Dolly's specific leave records
SELECT 'Dolly Jhamb leave records:' as step;
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
ORDER BY l.leave_date;

-- Step 4: Count unpaid leave days for Dolly in October 2025
SELECT 'Dolly Jhamb unpaid leave days count:' as step;
SELECT 
  p.name,
  COUNT(*) as total_leaves,
  COUNT(*) FILTER (WHERE is_paid_leave = true) as paid_leaves,
  COUNT(*) FILTER (WHERE is_paid_leave = false) as unpaid_leaves
FROM public.profiles p
JOIN public.leaves l ON l.user_id = p.user_id
WHERE p.name ILIKE '%dolly%'
  AND l.leave_date >= '2025-10-01' 
  AND l.leave_date < '2025-11-01'
GROUP BY p.name;

-- Step 5: Test the functions with correct parameters
SELECT 'Test functions with correct parameters:' as step;
SELECT 
  p.name,
  es.base_salary,
  public.calculate_daily_salary_rate(p.user_id, '2025-10-01'::DATE) as daily_rate,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2025-10-01'::DATE) as unpaid_days,
  public.calculate_month_leave_deductions(p.user_id, '2025-10-01'::DATE) as deduction_calculation
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
WHERE p.name ILIKE '%dolly%';

-- Step 6: Manual calculation for verification
SELECT 'Manual calculation for verification:' as step;
SELECT 
  p.name,
  es.base_salary,
  -- Manual daily rate calculation: base_salary / 27 work days
  (es.base_salary / 27) as manual_daily_rate,
  -- Count unpaid leave days manually
  (SELECT COUNT(*) FROM public.leaves l 
   WHERE l.user_id = p.user_id 
     AND l.leave_date >= '2025-10-01' 
     AND l.leave_date < '2025-11-01'
     AND l.is_paid_leave = false) as manual_unpaid_days,
  -- Manual deduction calculation
  ((es.base_salary / 27) * 
   (SELECT COUNT(*) FROM public.leaves l 
    WHERE l.user_id = p.user_id 
      AND l.leave_date >= '2025-10-01' 
      AND l.leave_date < '2025-11-01'
      AND l.is_paid_leave = false)) as manual_deduction
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
WHERE p.name ILIKE '%dolly%';

-- Step 7: Check if there are any issues with the functions
SELECT 'Check function issues:' as step;
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

