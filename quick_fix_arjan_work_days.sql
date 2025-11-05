-- Quick fix for Arjan Singh's work days issue
-- This script creates default work days for all employees without configuration

-- Step 1: Create default work days for all employees who don't have configuration
INSERT INTO employee_work_days (user_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday)
SELECT 
  p.user_id,
  true as monday,
  true as tuesday,
  true as wednesday,
  true as thursday,
  true as friday,
  false as saturday,
  false as sunday
FROM profiles p
WHERE p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM employee_work_days ewd 
    WHERE ewd.user_id = p.user_id
  )
ON CONFLICT (user_id) DO NOTHING;

-- Step 2: Verify the fix
SELECT 'Verification: Check work days configuration' as step;
SELECT 
  p.name,
  p.user_id,
  ewd.monday,
  ewd.tuesday,
  ewd.wednesday,
  ewd.thursday,
  ewd.friday,
  ewd.saturday,
  ewd.sunday
FROM profiles p
JOIN employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%'
ORDER BY p.name;

-- Step 3: Test the existing get_employee_work_days function
SELECT 'Test: get_employee_work_days function' as step;
SELECT * FROM get_employee_work_days(
  (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1)
);

-- Step 4: Test the existing calculate_month_leave_deductions function
SELECT 'Test: calculate_month_leave_deductions function' as step;
SELECT * FROM calculate_month_leave_deductions(
  (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1),
  '2024-01-01'::DATE
);

-- Step 5: Manual calculation for Arjan Singh
SELECT 'Manual calculation for Arjan Singh' as step;
WITH salary_info AS (
  SELECT 
    p.name,
    es.base_salary
  FROM profiles p
  JOIN employee_salaries es ON es.user_id = p.user_id
  WHERE p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%'
  LIMIT 1
),
work_days_calc AS (
  SELECT 
    COUNT(*) as work_days
  FROM (
    SELECT 
      generate_series(
        '2024-01-01'::DATE,
        '2024-01-31'::DATE,
        '1 day'::INTERVAL
      )::DATE as day
  ) md
  CROSS JOIN LATERAL (
    SELECT 
      CASE EXTRACT(DOW FROM md.day)
        WHEN 0 THEN false  -- Sunday
        WHEN 1 THEN true   -- Monday
        WHEN 2 THEN true   -- Tuesday
        WHEN 3 THEN true   -- Wednesday
        WHEN 4 THEN true   -- Thursday
        WHEN 5 THEN true   -- Friday
        WHEN 6 THEN false  -- Saturday
      END as is_work_day
  ) calc
  WHERE calc.is_work_day = true
)
SELECT 
  si.name,
  si.base_salary,
  wdc.work_days,
  si.base_salary / wdc.work_days as daily_rate,
  2 as unpaid_days,
  (si.base_salary / wdc.work_days) * 2 as leave_deduction,
  si.base_salary - ((si.base_salary / wdc.work_days) * 2) as net_salary
FROM salary_info si
CROSS JOIN work_days_calc wdc;



