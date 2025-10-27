-- CHECK DOLLY CALCULATION SCRIPT
-- This will help us understand what's wrong with Dolly's calculation

-- Step 1: Check Dolly's salary and work days
SELECT 'Dolly Jhamb salary and work days:' as step;
SELECT 
  p.name,
  es.base_salary,
  es.effective_from,
  es.effective_to,
  ewd.monday,
  ewd.tuesday,
  ewd.wednesday,
  ewd.thursday,
  ewd.friday,
  ewd.saturday,
  ewd.sunday
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
LEFT JOIN public.employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.name ILIKE '%dolly%';

-- Step 2: Check Dolly's leave records
SELECT 'Dolly Jhamb leave records:' as step;
SELECT 
  p.name,
  l.leave_date,
  l.leave_type_name,
  l.is_paid_leave,
  l.is_approved,
  l.notes
FROM public.profiles p
JOIN public.leaves l ON l.user_id = p.user_id
WHERE p.name ILIKE '%dolly%'
ORDER BY l.leave_date;

-- Step 3: Manual calculation for October 2025
SELECT 'Manual calculation for October 2025:' as step;
SELECT 
  'October 2025' as month,
  COUNT(*) as total_days,
  COUNT(*) FILTER (WHERE EXTRACT(DOW FROM day_date) IN (1,2,3,4,5,6)) as mon_sat_days,
  COUNT(*) FILTER (WHERE EXTRACT(DOW FROM day_date) IN (1,2,3,4,5)) as mon_fri_days
FROM (
  SELECT generate_series('2025-10-01'::DATE, '2025-10-31'::DATE, '1 day'::interval)::DATE as day_date
) days;

-- Step 4: Test the functions directly
SELECT 'Test functions directly:' as step;
SELECT 
  p.name,
  p.user_id,
  es.base_salary,
  public.calculate_daily_salary_rate(p.user_id, '2025-10-01'::DATE) as daily_rate,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2025-10-01'::DATE) as unpaid_days,
  public.calculate_month_leave_deductions(p.user_id, '2025-10-01'::DATE) as deduction_calculation
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
WHERE p.name ILIKE '%dolly%';

-- Step 5: Check what the frontend is showing vs what we calculate
SELECT 'Frontend vs Database calculation:' as step;
SELECT 
  'Frontend shows' as source,
  '₹5,000' as base_salary,
  '₹217' as daily_rate,
  '23' as work_days,
  '2' as unpaid_days,
  '₹435' as deduction
UNION ALL
SELECT 
  'Database shows' as source,
  es.base_salary::TEXT as base_salary,
  public.calculate_daily_salary_rate(p.user_id, '2025-10-01'::DATE)::TEXT as daily_rate,
  '?' as work_days,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2025-10-01'::DATE)::TEXT as unpaid_days,
  '?' as deduction
FROM public.profiles p
LEFT JOIN public.employee_salaries es ON es.user_id = p.user_id AND es.is_active = true
WHERE p.name ILIKE '%dolly%';
