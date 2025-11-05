-- DEBUG DAILY RATES SCRIPT
-- This will help us understand why daily rates are not being calculated

-- Step 1: Check Dolly Jhamb's configuration
SELECT 'Dolly Jhamb configuration:' as step;
SELECT 
  p.name,
  p.employee_category_id,
  ec.name as category_name,
  es.base_salary,
  es.is_active as salary_active,
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
LEFT JOIN public.employee_categories ec ON ec.id = p.employee_category_id
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id
LEFT JOIN public.employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.name ILIKE '%dolly%'
ORDER BY p.name;

-- Step 2: Check Isha Sharma's configuration
SELECT 'Isha Sharma configuration:' as step;
SELECT 
  p.name,
  p.employee_category_id,
  ec.name as category_name,
  es.base_salary,
  es.is_active as salary_active,
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
LEFT JOIN public.employee_categories ec ON ec.id = p.employee_category_id
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id
LEFT JOIN public.employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.name ILIKE '%isha%'
ORDER BY p.name;

-- Step 3: Check if calculate_daily_salary_rate function exists
SELECT 'Check if calculate_daily_salary_rate function exists:' as step;
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_name = 'calculate_daily_salary_rate'
  AND routine_schema = 'public';

-- Step 4: Test calculate_daily_salary_rate function directly
SELECT 'Test calculate_daily_salary_rate function:' as step;
SELECT 
  p.name,
  es.base_salary,
  public.calculate_daily_salary_rate(p.user_id, '2025-10-01'::DATE) as daily_rate
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
WHERE p.name IN ('Dolly Jhamb', 'Isha Sharma')
ORDER BY p.name;

-- Step 5: Check if get_employee_work_days_summary function exists
SELECT 'Check if get_employee_work_days_summary function exists:' as step;
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_name = 'get_employee_work_days_summary'
  AND routine_schema = 'public';

-- Step 6: Manual work days calculation for October 2025
SELECT 'Manual work days calculation for October 2025:' as step;
SELECT 
  p.name,
  es.base_salary,
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
   CASE WHEN ewd.sunday = true THEN 1 ELSE 0 END) as work_days_per_week,
  -- October 2025 has 31 days, so approximately 4.4 weeks
  ROUND(
    (CASE WHEN ewd.monday = true THEN 1 ELSE 0 END +
     CASE WHEN ewd.tuesday = true THEN 1 ELSE 0 END +
     CASE WHEN ewd.wednesday = true THEN 1 ELSE 0 END +
     CASE WHEN ewd.thursday = true THEN 1 ELSE 0 END +
     CASE WHEN ewd.friday = true THEN 1 ELSE 0 END +
     CASE WHEN ewd.saturday = true THEN 1 ELSE 0 END +
     CASE WHEN ewd.sunday = true THEN 1 ELSE 0 END) * 4.4
  ) as estimated_work_days_in_october,
  -- Calculate daily rate manually
  CASE 
    WHEN es.base_salary IS NOT NULL AND es.base_salary > 0 THEN
      es.base_salary / GREATEST(
        ROUND(
          (CASE WHEN ewd.monday = true THEN 1 ELSE 0 END +
           CASE WHEN ewd.tuesday = true THEN 1 ELSE 0 END +
           CASE WHEN ewd.wednesday = true THEN 1 ELSE 0 END +
           CASE WHEN ewd.thursday = true THEN 1 ELSE 0 END +
           CASE WHEN ewd.friday = true THEN 1 ELSE 0 END +
           CASE WHEN ewd.saturday = true THEN 1 ELSE 0 END +
           CASE WHEN ewd.sunday = true THEN 1 ELSE 0 END) * 4.4
        ), 1
      )
    ELSE 0
  END as manual_daily_rate
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
LEFT JOIN public.employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.name IN ('Dolly Jhamb', 'Isha Sharma')
ORDER BY p.name;

-- Step 7: Check all employees with salaries
SELECT 'All employees with salaries:' as step;
SELECT 
  p.name,
  es.base_salary,
  es.is_active as salary_active,
  es.effective_from,
  es.effective_to,
  public.calculate_daily_salary_rate(p.user_id, '2025-10-01'::DATE) as daily_rate
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
WHERE p.is_active = true
  AND es.base_salary IS NOT NULL
  AND es.base_salary > 0
ORDER BY p.name;



