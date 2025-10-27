-- Debug script to check leaves data and function behavior
-- This will help identify why employees show 0 unpaid days

-- 1. Check what data exists in the leaves table
SELECT 
  'Leaves Table Data' as section,
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_paid_leave = false THEN 1 END) as unpaid_leaves,
  COUNT(CASE WHEN is_paid_leave = true THEN 1 END) as paid_leaves,
  COUNT(CASE WHEN is_approved = true THEN 1 END) as approved_leaves
FROM public.leaves;

-- 2. Check leaves for current month (November 2025)
SELECT 
  'Current Month Leaves' as section,
  user_id,
  leave_date,
  is_paid_leave,
  is_approved,
  leave_type_name
FROM public.leaves 
WHERE leave_date >= '2025-11-01' 
  AND leave_date <= '2025-11-30'
ORDER BY user_id, leave_date;

-- 3. Check specific employee leaves (if any exist)
SELECT 
  'Employee Leaves Sample' as section,
  l.user_id,
  p.name as employee_name,
  l.leave_date,
  l.is_paid_leave,
  l.is_approved,
  l.leave_type_name
FROM public.leaves l
JOIN public.profiles p ON p.user_id = l.user_id
WHERE l.leave_date >= '2025-11-01' 
  AND l.leave_date <= '2025-11-30'
  AND l.is_paid_leave = false
  AND l.is_approved = true
LIMIT 10;

-- 4. Test the function with a specific employee
SELECT 
  'Function Test' as section,
  *
FROM public.calculate_employee_leave_deductions(
  (SELECT user_id FROM public.profiles LIMIT 1),
  '2025-11-01'::date,
  100.00
);

-- 5. Check if there are any leaves at all in the system
SELECT 
  'All Leaves Summary' as section,
  DATE_TRUNC('month', leave_date) as month,
  COUNT(*) as total_leaves,
  COUNT(CASE WHEN is_paid_leave = false THEN 1 END) as unpaid_leaves,
  COUNT(CASE WHEN is_paid_leave = true THEN 1 END) as paid_leaves
FROM public.leaves
GROUP BY DATE_TRUNC('month', leave_date)
ORDER BY month DESC
LIMIT 12;
