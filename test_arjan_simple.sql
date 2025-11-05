-- Simple test script for Arjan Singh's work days issue
-- This script tests the existing functions and identifies the problem

-- Step 1: Find Arjan Singh's user_id
SELECT 'Step 1: Find Arjan Singh' as step;
SELECT 
  id,
  name,
  user_id,
  email,
  is_active
FROM profiles 
WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%'
ORDER BY name;

-- Step 2: Check if Arjan Singh has work days configuration
SELECT 'Step 2: Check Work Days Configuration' as step;
SELECT 
  p.name,
  p.user_id,
  ewd.monday,
  ewd.tuesday,
  ewd.wednesday,
  ewd.thursday,
  ewd.friday,
  ewd.saturday,
  ewd.sunday,
  CASE 
    WHEN ewd.user_id IS NULL THEN 'No Configuration'
    ELSE 'Has Configuration'
  END as config_status
FROM profiles p
LEFT JOIN employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%'
ORDER BY p.name;

-- Step 3: Test the existing get_employee_work_days function
SELECT 'Step 3: Test get_employee_work_days Function' as step;
SELECT * FROM get_employee_work_days(
  (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1)
);

-- Step 4: Check if Arjan Singh has a salary record
SELECT 'Step 4: Check Salary Record' as step;
SELECT 
  p.name,
  es.base_salary,
  es.is_active,
  es.effective_from,
  es.effective_to
FROM profiles p
LEFT JOIN employee_salaries es ON es.user_id = p.user_id
WHERE p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%'
ORDER BY es.effective_from DESC;

-- Step 5: Manual work days calculation for January 2024
SELECT 'Step 5: Manual Work Days Calculation for January 2024' as step;
WITH work_days_config AS (
  SELECT * FROM get_employee_work_days(
    (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1)
  )
),
month_days AS (
  SELECT 
    generate_series(
      '2024-01-01'::DATE,
      '2024-01-31'::DATE,
      '1 day'::INTERVAL
    )::DATE as day
),
work_days_calc AS (
  SELECT 
    md.day,
    EXTRACT(DOW FROM md.day) as day_of_week,
    CASE EXTRACT(DOW FROM md.day)
      WHEN 0 THEN wdc.sunday
      WHEN 1 THEN wdc.monday
      WHEN 2 THEN wdc.tuesday
      WHEN 3 THEN wdc.wednesday
      WHEN 4 THEN wdc.thursday
      WHEN 5 THEN wdc.friday
      WHEN 6 THEN wdc.saturday
    END as is_work_day
  FROM month_days md
  CROSS JOIN work_days_config wdc
)
SELECT 
  COUNT(*) as total_days,
  COUNT(*) FILTER (WHERE is_work_day = true) as work_days,
  COUNT(*) FILTER (WHERE is_work_day = false) as non_work_days
FROM work_days_calc;

-- Step 6: Test the existing calculate_month_leave_deductions function
SELECT 'Step 6: Test calculate_month_leave_deductions Function' as step;
SELECT * FROM calculate_month_leave_deductions(
  (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1),
  '2024-01-01'::DATE
);

-- Step 7: Create default work days for Arjan Singh if missing
SELECT 'Step 7: Create Default Work Days for Arjan Singh' as step;
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
WHERE (p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%')
  AND NOT EXISTS (
    SELECT 1 FROM employee_work_days ewd 
    WHERE ewd.user_id = p.user_id
  )
ON CONFLICT (user_id) DO NOTHING;

-- Step 8: Verify the fix
SELECT 'Step 8: Verify Fix' as step;
SELECT 
  p.name,
  ewd.monday,
  ewd.tuesday,
  ewd.wednesday,
  ewd.thursday,
  ewd.friday,
  ewd.saturday,
  ewd.sunday
FROM profiles p
JOIN employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%';

-- Step 9: Test work days calculation again
SELECT 'Step 9: Test Work Days Calculation Again' as step;
WITH work_days_config AS (
  SELECT * FROM get_employee_work_days(
    (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1)
  )
),
month_days AS (
  SELECT 
    generate_series(
      '2024-01-01'::DATE,
      '2024-01-31'::DATE,
      '1 day'::INTERVAL
    )::DATE as day
),
work_days_calc AS (
  SELECT 
    md.day,
    EXTRACT(DOW FROM md.day) as day_of_week,
    CASE EXTRACT(DOW FROM md.day)
      WHEN 0 THEN wdc.sunday
      WHEN 1 THEN wdc.monday
      WHEN 2 THEN wdc.tuesday
      WHEN 3 THEN wdc.wednesday
      WHEN 4 THEN wdc.thursday
      WHEN 5 THEN wdc.friday
      WHEN 6 THEN wdc.saturday
    END as is_work_day
  FROM month_days md
  CROSS JOIN work_days_config wdc
)
SELECT 
  COUNT(*) as total_days,
  COUNT(*) FILTER (WHERE is_work_day = true) as work_days,
  COUNT(*) FILTER (WHERE is_work_day = false) as non_work_days
FROM work_days_calc;

-- Step 10: Test leave deduction calculation again
SELECT 'Step 10: Test Leave Deduction Calculation Again' as step;
SELECT * FROM calculate_month_leave_deductions(
  (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1),
  '2024-01-01'::DATE
);

-- Step 11: Calculate expected salary for Arjan Singh
SELECT 'Step 11: Calculate Expected Salary for Arjan Singh' as step;
WITH salary_info AS (
  SELECT 
    p.name,
    es.base_salary
  FROM profiles p
  JOIN employee_salaries es ON es.user_id = p.user_id
  WHERE p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%'
  LIMIT 1
),
work_days_info AS (
  SELECT 
    COUNT(*) FILTER (WHERE is_work_day = true) as work_days
  FROM (
    SELECT 
      generate_series(
        '2024-01-01'::DATE,
        '2024-01-31'::DATE,
        '1 day'::INTERVAL
      )::DATE as day
  ) md
  CROSS JOIN (
    SELECT 
      true as monday,
      true as tuesday,
      true as wednesday,
      true as thursday,
      true as friday,
      false as saturday,
      false as sunday
  ) wdc
  CROSS JOIN LATERAL (
    SELECT 
      CASE EXTRACT(DOW FROM md.day)
        WHEN 0 THEN wdc.sunday
        WHEN 1 THEN wdc.monday
        WHEN 2 THEN wdc.tuesday
        WHEN 3 THEN wdc.wednesday
        WHEN 4 THEN wdc.thursday
        WHEN 5 THEN wdc.friday
        WHEN 6 THEN wdc.saturday
      END as is_work_day
  ) calc
)
SELECT 
  si.name,
  si.base_salary,
  wdi.work_days,
  si.base_salary / wdi.work_days as daily_rate,
  2 as unpaid_days,
  (si.base_salary / wdi.work_days) * 2 as leave_deduction,
  si.base_salary - ((si.base_salary / wdi.work_days) * 2) as net_salary
FROM salary_info si
CROSS JOIN work_days_info wdi;



