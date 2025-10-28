-- Test script for improved leave deduction calculation
-- This script tests the new functions with different scenarios

-- Test 1: Standard employee (Mon-Fri) with 2 unpaid days
SELECT 'Test 1: Standard Employee (Mon-Fri)' as test_case;

-- First, let's see if we have any employees with work days configured
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
LEFT JOIN employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.is_active = true
LIMIT 5;

-- Test 2: Calculate work days summary for January 2024
SELECT 'Test 2: Work Days Summary for January 2024' as test_case;

-- This will show work days configuration and summary
SELECT * FROM get_employee_work_days_summary(
  (SELECT user_id FROM profiles WHERE is_active = true LIMIT 1),
  '2024-01-01'::DATE
);

-- Test 3: Calculate leave deductions for January 2024
SELECT 'Test 3: Leave Deductions for January 2024' as test_case;

-- This will show detailed leave deduction calculation
SELECT * FROM calculate_employee_leave_deductions(
  (SELECT user_id FROM profiles WHERE is_active = true LIMIT 1),
  '2024-01-01'::DATE,
  100.00
);

-- Test 4: Test with different deduction percentages
SELECT 'Test 4: Different Deduction Percentages' as test_case;

-- 50% deduction
SELECT 
  '50% Deduction' as scenario,
  * 
FROM calculate_employee_leave_deductions(
  (SELECT user_id FROM profiles WHERE is_active = true LIMIT 1),
  '2024-01-01'::DATE,
  50.00
);

-- 75% deduction
SELECT 
  '75% Deduction' as scenario,
  * 
FROM calculate_employee_leave_deductions(
  (SELECT user_id FROM profiles WHERE is_active = true LIMIT 1),
  '2024-01-01'::DATE,
  75.00
);

-- 100% deduction
SELECT 
  '100% Deduction' as scenario,
  * 
FROM calculate_employee_leave_deductions(
  (SELECT user_id FROM profiles WHERE is_active = true LIMIT 1),
  '2024-01-01'::DATE,
  100.00
);

-- Test 5: Compare old vs new calculation
SELECT 'Test 5: Comparison with Old Method' as test_case;

-- Old method (base_salary / 30)
SELECT 
  'Old Method (÷30)' as method,
  es.base_salary,
  es.base_salary / 30 as daily_rate_old,
  (es.base_salary / 30) * 2 as deduction_old
FROM employee_salaries es
WHERE es.is_active = true
LIMIT 1;

-- New method (work days based)
SELECT 
  'New Method (Work Days)' as method,
  base_salary,
  daily_rate,
  leave_deduction_amount as deduction_new
FROM calculate_employee_leave_deductions(
  (SELECT user_id FROM profiles WHERE is_active = true LIMIT 1),
  '2024-01-01'::DATE,
  100.00
);

-- Test 6: Check attendance data for unpaid days calculation
SELECT 'Test 6: Attendance Data Analysis' as test_case;

-- Check if we have attendance data for the test month
SELECT 
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE status = 'absent') as absent_records,
  COUNT(*) FILTER (WHERE manual_status = 'absent') as manual_absent_records
FROM unified_attendance
WHERE entry_date BETWEEN '2024-01-01' AND '2024-01-31';

-- Test 7: Employee work days configuration
SELECT 'Test 7: Work Days Configuration' as test_case;

-- Show current work days configurations
SELECT 
  p.name,
  CASE 
    WHEN ewd.user_id IS NULL THEN 'Default (Mon-Fri)'
    ELSE 'Custom Configuration'
  END as config_type,
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

-- Test 8: Month-specific work days calculation
SELECT 'Test 8: Month-Specific Work Days' as test_case;

-- Calculate work days for different months
SELECT 
  'January 2024' as month,
  * 
FROM get_employee_work_days_summary(
  (SELECT user_id FROM profiles WHERE is_active = true LIMIT 1),
  '2024-01-01'::DATE
);

SELECT 
  'February 2024' as month,
  * 
FROM get_employee_work_days_summary(
  (SELECT user_id FROM profiles WHERE is_active = true LIMIT 1),
  '2024-02-01'::DATE
);

-- Test 9: Edge cases
SELECT 'Test 9: Edge Cases' as test_case;

-- Test with employee who has no salary record
SELECT * FROM calculate_employee_leave_deductions(
  '00000000-0000-0000-0000-000000000000'::UUID,
  '2024-01-01'::DATE,
  100.00
);

-- Test with invalid user ID
SELECT * FROM get_employee_work_days_summary(
  '00000000-0000-0000-0000-000000000000'::UUID,
  '2024-01-01'::DATE
);

-- Summary
SELECT 'Test Summary' as section;
SELECT 
  'All tests completed. Check results above for any issues.' as status;

