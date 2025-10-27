-- Debug script for Arjan Singh's work days configuration
-- This script will help identify why the work days calculation is returning 0

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
  ewd.created_at,
  ewd.updated_at
FROM profiles p
LEFT JOIN employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%'
ORDER BY p.name;

-- Step 3: Test the get_employee_work_days function for Arjan Singh
SELECT 'Step 3: Test get_employee_work_days Function' as step;
SELECT * FROM get_employee_work_days(
  (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1)
);

-- Step 4: Test work days summary for January 2024
SELECT 'Step 4: Test Work Days Summary for January 2024' as step;
SELECT * FROM get_employee_work_days_summary(
  (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1),
  '2024-01-01'::DATE
);

-- Step 5: Test leave deduction calculation
SELECT 'Step 5: Test Leave Deduction Calculation' as step;
SELECT * FROM calculate_employee_leave_deductions(
  (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1),
  '2024-01-01'::DATE,
  100.00
);

-- Step 6: Check if Arjan Singh has a salary record
SELECT 'Step 6: Check Salary Record' as step;
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

-- Step 7: Manual work days calculation for January 2024
SELECT 'Step 7: Manual Work Days Calculation' as step;
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

-- Step 8: Check all employees' work days configurations
SELECT 'Step 8: All Employees Work Days Configuration' as step;
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

-- Step 9: Check if there are any issues with the employee_work_days table
SELECT 'Step 9: Check employee_work_days Table Structure' as step;
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'employee_work_days' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 10: Check if there are any RLS issues
SELECT 'Step 10: Check RLS Policies' as step;
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

-- Step 11: Test with a known working employee
SELECT 'Step 11: Test with First Active Employee' as step;
SELECT * FROM get_employee_work_days_summary(
  (SELECT user_id FROM profiles WHERE is_active = true LIMIT 1),
  '2024-01-01'::DATE
);

-- Step 12: Create default work days for Arjan Singh if missing
SELECT 'Step 12: Create Default Work Days for Arjan Singh' as step;
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

-- Step 13: Verify the fix
SELECT 'Step 13: Verify Fix' as step;
SELECT * FROM get_employee_work_days_summary(
  (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1),
  '2024-01-01'::DATE
);

-- Step 14: Test leave deduction calculation again
SELECT 'Step 14: Test Leave Deduction Calculation Again' as step;
SELECT * FROM calculate_employee_leave_deductions(
  (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1),
  '2024-01-01'::DATE,
  100.00
);
