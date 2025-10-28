-- Debug script for Dolly Jhamb's work days issue
-- This script will help identify why the work days calculation is still wrong

-- Step 1: Find Dolly Jhamb's user_id
SELECT 'Step 1: Find Dolly Jhamb' as step;
SELECT 
  id,
  name,
  user_id,
  email,
  is_active
FROM profiles 
WHERE name ILIKE '%dolly%' OR name ILIKE '%jhamb%'
ORDER BY name;

-- Step 2: Check Dolly Jhamb's work days configuration
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
  ewd.created_at,
  ewd.updated_at
FROM profiles p
LEFT JOIN employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.name ILIKE '%dolly%' OR p.name ILIKE '%jhamb%'
ORDER BY p.name;

-- Step 3: Test the get_employee_work_days function for Dolly Jhamb
SELECT 'Step 3: Test get_employee_work_days Function' as step;
SELECT * FROM get_employee_work_days(
  (SELECT user_id FROM profiles WHERE name ILIKE '%dolly%' OR name ILIKE '%jhamb%' LIMIT 1)
);

-- Step 4: Manual work days calculation for January 2024
SELECT 'Step 4: Manual Work Days Calculation for January 2024' as step;
WITH work_days_config AS (
  SELECT * FROM get_employee_work_days(
    (SELECT user_id FROM profiles WHERE name ILIKE '%dolly%' OR name ILIKE '%jhamb%' LIMIT 1)
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

-- Step 5: Check Dolly Jhamb's salary record
SELECT 'Step 5: Check Salary Record' as step;
SELECT 
  p.name,
  es.base_salary,
  es.is_active,
  es.effective_from,
  es.effective_to
FROM profiles p
LEFT JOIN employee_salaries es ON es.user_id = p.user_id
WHERE p.name ILIKE '%dolly%' OR p.name ILIKE '%jhamb%'
ORDER BY es.effective_from DESC;

-- Step 6: Test the existing calculate_month_leave_deductions function
SELECT 'Step 6: Test calculate_month_leave_deductions Function' as step;
SELECT * FROM calculate_month_leave_deductions(
  (SELECT user_id FROM profiles WHERE name ILIKE '%dolly%' OR name ILIKE '%jhamb%' LIMIT 1),
  '2024-01-01'::DATE
);

-- Step 7: Check attendance data for Dolly Jhamb
SELECT 'Step 7: Check Attendance Data' as step;
SELECT 
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE status = 'absent') as absent_records,
  COUNT(*) FILTER (WHERE manual_status = 'absent') as manual_absent_records,
  COUNT(*) FILTER (WHERE status = 'absent' OR manual_status = 'absent') as total_absent
FROM unified_attendance
WHERE user_id = (SELECT user_id FROM profiles WHERE name ILIKE '%dolly%' OR name ILIKE '%jhamb%' LIMIT 1)
  AND entry_date BETWEEN '2024-01-01' AND '2024-01-31';

-- Step 8: Check if there are any issues with the employee_work_days table structure
SELECT 'Step 8: Check employee_work_days Table Structure' as step;
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'employee_work_days' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 9: Check all employees' work days configurations
SELECT 'Step 9: All Employees Work Days Configuration' as step;
SELECT 
  p.name,
  p.user_id,
  CASE 
    WHEN ewd.user_id IS NULL THEN 'No Configuration (Default Mon-Fri)'
    ELSE 'Custom Configuration'
  END as config_status,
  COALESCE(ewd.monday, true) as monday,
  COALESCE(ewd.tuesday, true) as tuesday,
  COALESCE(ewd.wednesday, true) as wednesday,
  COALESCE(ewd.thursday, true) as thursday,
  COALESCE(ewd.friday, true) as friday,
  COALESCE(ewd.saturday, false) as saturday,
  COALESCE(ewd.sunday, false) as sunday
FROM profiles p
LEFT JOIN employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.is_active = true
ORDER BY p.name;

-- Step 10: Test with a known working employee
SELECT 'Step 10: Test with First Active Employee' as step;
SELECT * FROM get_employee_work_days(
  (SELECT user_id FROM profiles WHERE is_active = true LIMIT 1)
);

-- Step 11: Manual calculation for Dolly Jhamb with correct work days
SELECT 'Step 11: Manual Calculation for Dolly Jhamb' as step;
WITH salary_info AS (
  SELECT 
    p.name,
    es.base_salary
  FROM profiles p
  JOIN employee_salaries es ON es.user_id = p.user_id
  WHERE p.name ILIKE '%dolly%' OR p.name ILIKE '%jhamb%'
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
  3 as unpaid_days,  -- Dolly has 3 unpaid leaves
  (si.base_salary / wdc.work_days) * 3 as leave_deduction,
  si.base_salary - ((si.base_salary / wdc.work_days) * 3) as net_salary
FROM salary_info si
CROSS JOIN work_days_calc wdc;

-- Step 12: Check if there are any RLS issues
SELECT 'Step 12: Check RLS Policies' as step;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'employee_work_days';

-- Step 13: Test the existing calculate_daily_salary_rate function
SELECT 'Step 13: Test calculate_daily_salary_rate Function' as step;
SELECT * FROM calculate_daily_salary_rate(
  (SELECT user_id FROM profiles WHERE name ILIKE '%dolly%' OR name ILIKE '%jhamb%' LIMIT 1),
  '2024-01-01'::DATE
);

