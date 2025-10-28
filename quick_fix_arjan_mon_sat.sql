-- Quick fix for Arjan Singh's work days configuration
-- Set Arjan Singh to work Mon-Sat (6 days per week) with Sunday as office holiday

-- Step 1: Update Arjan Singh's work days to Mon-Sat
UPDATE employee_work_days 
SET 
  monday = true,
  tuesday = true,
  wednesday = true,
  thursday = true,
  friday = true,
  saturday = true,  -- Arjan works on Saturday
  sunday = false   -- Sunday is office holiday
WHERE user_id = (
  SELECT user_id FROM profiles 
  WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%'
  LIMIT 1
);

-- Step 2: If no work days record exists, create one
INSERT INTO employee_work_days (user_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday)
SELECT 
  p.user_id,
  true as monday,
  true as tuesday,
  true as wednesday,
  true as thursday,
  true as friday,
  true as saturday,  -- Arjan works on Saturday
  false as sunday   -- Sunday is office holiday
FROM profiles p
WHERE (p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%')
  AND NOT EXISTS (
    SELECT 1 FROM employee_work_days ewd 
    WHERE ewd.user_id = p.user_id
  )
ON CONFLICT (user_id) DO UPDATE SET
  monday = EXCLUDED.monday,
  tuesday = EXCLUDED.tuesday,
  wednesday = EXCLUDED.wednesday,
  thursday = EXCLUDED.thursday,
  friday = EXCLUDED.friday,
  saturday = EXCLUDED.saturday,
  sunday = EXCLUDED.sunday;

-- Step 3: Verify the update
SELECT 'Verification: Arjan Singh work days configuration' as step;
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
WHERE p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%';

-- Step 4: Test work days calculation for January 2024
SELECT 'Test: Work days calculation for January 2024' as step;
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

-- Step 5: Test daily rate calculation
SELECT 'Test: Daily rate calculation' as step;
SELECT 
  p.name,
  es.base_salary,
  calculate_daily_salary_rate(p.user_id, '2024-01-01'::DATE) as daily_rate
FROM profiles p
JOIN employee_salaries es ON es.user_id = p.user_id
WHERE p.name ILIKE '%arjan%' OR p.name ILIKE '%singh%';

-- Step 6: Check attendance data for unpaid leave
SELECT 'Test: Attendance data for unpaid leave' as step;
SELECT 
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE status = 'absent') as absent_records,
  COUNT(*) FILTER (WHERE manual_status = 'absent') as manual_absent_records,
  COUNT(*) FILTER (WHERE status = 'office_holiday') as office_holiday_records,
  COUNT(*) FILTER (WHERE status = 'absent' OR manual_status = 'absent') as total_absent
FROM unified_attendance
WHERE user_id = (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1)
  AND entry_date BETWEEN '2024-01-01' AND '2024-01-31';

-- Step 7: Test leave deduction calculation
SELECT 'Test: Leave deduction calculation' as step;
SELECT * FROM calculate_month_leave_deductions(
  (SELECT user_id FROM profiles WHERE name ILIKE '%arjan%' OR name ILIKE '%singh%' LIMIT 1),
  '2024-01-01'::DATE
);

