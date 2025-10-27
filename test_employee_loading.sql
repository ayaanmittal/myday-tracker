-- Test script to verify employee loading works
-- This script tests the queries used in the salary management system

-- Test 1: Check if profiles table exists and has data
SELECT 'Testing profiles table...' as test_step;

SELECT 
  COUNT(*) as total_profiles,
  COUNT(*) FILTER (WHERE is_active = true) as active_profiles
FROM public.profiles;

-- Test 2: Check profiles with basic info
SELECT 'Sample profiles data:' as test_step;

SELECT 
  p.id,
  p.name,
  p.email,
  p.designation,
  p.team,
  p.is_active,
  ec.name as employee_category
FROM public.profiles p
LEFT JOIN public.employee_categories ec ON ec.id = p.employee_category_id
WHERE p.is_active = true 
ORDER BY p.name 
LIMIT 5;

-- Test 3: Check employee_salaries table
SELECT 'Testing employee_salaries table...' as test_step;

SELECT 
  COUNT(*) as total_salaries,
  COUNT(*) FILTER (WHERE is_active = true) as active_salaries
FROM public.employee_salaries;

-- Test 4: Check if there are any salary records
SELECT 'Sample salary data:' as test_step;

SELECT 
  user_id,
  base_salary,
  is_active,
  effective_from
FROM public.employee_salaries 
WHERE is_active = true 
ORDER BY effective_from DESC 
LIMIT 5;

-- Test 5: Test the combined query logic
SELECT 'Testing combined employee data...' as test_step;

WITH employee_data AS (
  SELECT 
    p.id,
    p.name,
    p.email,
    p.designation,
    p.team,
    p.phone,
    p.address,
    p.joined_on_date,
    p.user_id,
    p.is_active,
    ec.name as employee_category,
    p.probation_period_months,
    es.base_salary,
    CASE 
      WHEN es.base_salary IS NOT NULL AND es.base_salary > 0 
      THEN 'Salary Set' 
      ELSE 'No Salary' 
    END as salary_status
  FROM public.profiles p
  LEFT JOIN public.employee_categories ec ON ec.id = p.employee_category_id
  LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
  WHERE p.is_active = true
  ORDER BY p.name
)
SELECT 
  COUNT(*) as total_employees,
  COUNT(*) FILTER (WHERE salary_status = 'Salary Set') as employees_with_salary,
  COUNT(*) FILTER (WHERE salary_status = 'No Salary') as employees_without_salary
FROM employee_data;

-- Test 6: Show sample combined data
SELECT 'Sample combined employee data:' as test_step;

SELECT 
  name,
  designation,
  team,
  employee_category,
  base_salary,
  CASE 
    WHEN base_salary IS NOT NULL AND base_salary > 0 
    THEN 'Salary Set' 
    ELSE 'No Salary' 
  END as salary_status
FROM (
  SELECT 
    p.name,
    p.designation,
    p.team,
    ec.name as employee_category,
    es.base_salary
  FROM public.profiles p
  LEFT JOIN public.employee_categories ec ON ec.id = p.employee_category_id
  LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
  WHERE p.is_active = true
  ORDER BY p.name
  LIMIT 10
) sample_data;

-- Test 7: Check for any RLS issues
SELECT 'Checking RLS policies...' as test_step;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('profiles', 'employee_salaries')
ORDER BY tablename, policyname;
