-- Test the updated RPC function to verify holiday titles are included
-- This will show the deduction reasons with holiday titles

-- Test the get_employee_leaves_with_salary_deductions function
SELECT 
  l.leave_date,
  l.leave_type_name,
  l.deduction_amount,
  l.deduction_reason,
  l.is_office_holiday
FROM public.get_employee_leaves_with_salary_deductions(
  (SELECT id FROM public.profiles WHERE email = 'sakshisaglotia@gmail.com' LIMIT 1),
  '2025-10-01'
) l
ORDER BY l.leave_date;

-- Expected results should show:
-- 2025-10-01: "Office holiday - Gandhi Jayanti - no deduction"
-- 2025-10-05: "Sunday - no deduction" 
-- 2025-10-15: "Unpaid leave deduction"
-- 2025-10-19: "Sunday - no deduction"
-- 2025-10-20: "Office holiday - Diwali - no deduction"
-- 2025-10-25: "Unpaid leave deduction"
-- 2025-10-26: "Sunday - no deduction"
-- 2025-10-27: "Unpaid leave deduction"



