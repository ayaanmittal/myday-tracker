-- Simple debug script to check leaves data
-- This will help identify why employees show 0 unpaid days

-- 1. Check if there are any leaves at all
SELECT 
  'Total Leaves' as info,
  COUNT(*) as count
FROM public.leaves;

-- 2. Check leaves by month
SELECT 
  'Leaves by Month' as info,
  DATE_TRUNC('month', leave_date) as month,
  COUNT(*) as total_leaves,
  COUNT(CASE WHEN is_paid_leave = false THEN 1 END) as unpaid_leaves,
  COUNT(CASE WHEN is_paid_leave = true THEN 1 END) as paid_leaves
FROM public.leaves
GROUP BY DATE_TRUNC('month', leave_date)
ORDER BY month DESC
LIMIT 6;

-- 3. Check specific employee leaves for current month
SELECT 
  'Current Month Leaves' as info,
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
ORDER BY l.user_id, l.leave_date;

-- 4. Check unpaid leaves specifically
SELECT 
  'Unpaid Leaves' as info,
  l.user_id,
  p.name as employee_name,
  l.leave_date,
  l.leave_type_name
FROM public.leaves l
JOIN public.profiles p ON p.user_id = l.user_id
WHERE l.leave_date >= '2025-11-01' 
  AND l.leave_date <= '2025-11-30'
  AND l.is_paid_leave = false
  AND l.is_approved = true
ORDER BY l.user_id, l.leave_date;

-- 5. Test function with first employee
SELECT 
  'Function Test' as info,
  *
FROM public.calculate_employee_leave_deductions(
  (SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL LIMIT 1),
  '2025-11-01'::date,
  100.00
);
