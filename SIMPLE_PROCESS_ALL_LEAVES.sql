-- SIMPLE PROCESS ALL LEAVES SCRIPT
-- This will process all approved leave requests without relying on complex functions

-- Step 1: Check current state
SELECT 'Current state before processing:' as step;
SELECT 
  'Leave Requests' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_records,
  COUNT(*) FILTER (WHERE status = 'approved' AND processed = false) as unprocessed_approved
FROM public.leave_requests
UNION ALL
SELECT 
  'Leaves' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE is_paid_leave = true) as paid_leaves,
  COUNT(*) FILTER (WHERE is_paid_leave = false) as unpaid_leaves
FROM public.leaves;

-- Step 2: Show approved leave requests that need processing
SELECT 'Approved leave requests that need processing:' as step;
SELECT 
  p.name,
  lr.start_date,
  lr.end_date,
  lr.days_requested,
  lr.status,
  lr.processed,
  lt.name as leave_type_name,
  lt.is_paid as leave_type_default_paid
FROM public.profiles p
JOIN public.leave_requests lr ON lr.user_id = p.user_id
JOIN public.leave_types lt ON lt.id = lr.leave_type_id
WHERE lr.status = 'approved'
ORDER BY p.name, lr.start_date;

-- Step 3: Fix missing work days configuration
-- Insert default work days for employees who don't have them
INSERT INTO public.employee_work_days (
  user_id,
  monday,
  tuesday,
  wednesday,
  thursday,
  friday,
  saturday,
  sunday
)
SELECT 
  p.user_id,
  true,  -- Monday
  true,  -- Tuesday
  true,  -- Wednesday
  true,  -- Thursday
  true,  -- Friday
  false, -- Saturday
  false  -- Sunday
FROM public.profiles p
WHERE p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.employee_work_days ewd 
    WHERE ewd.user_id = p.user_id
  );

-- Step 4: Process ALL approved leave requests (any date)
-- Create leave records for each day in approved leave requests
INSERT INTO public.leaves (
  user_id,
  profile_id,
  leave_date,
  leave_type_id,
  leave_type_name,
  is_paid_leave,
  is_approved,
  approved_by,
  approved_at,
  leave_request_id,
  created_by,
  notes
)
SELECT 
  lr.user_id,
  p.id as profile_id,
  leave_date,
  lr.leave_type_id,
  lt.name as leave_type_name,
  COALESCE(lp.is_paid, lt.is_paid) as is_paid_leave,
  true as is_approved,
  lr.approved_by,
  lr.approved_at,
  lr.id as leave_request_id,
  lr.approved_by as created_by,
  'Auto-generated from approved leave request' as notes
FROM public.leave_requests lr
JOIN public.profiles p ON p.user_id = lr.user_id
JOIN public.leave_types lt ON lt.id = lr.leave_type_id
LEFT JOIN public.leave_policies lp ON lp.employee_category_id = p.employee_category_id 
  AND lp.leave_type_id = lr.leave_type_id 
  AND lp.is_active = true
CROSS JOIN LATERAL generate_series(lr.start_date, lr.end_date, '1 day'::interval) AS leave_date
WHERE lr.status = 'approved'
  AND lr.processed = false
  AND NOT EXISTS (
    SELECT 1 FROM public.leaves l 
    WHERE l.user_id = lr.user_id 
      AND l.leave_date = leave_date
  );

-- Step 5: Mark processed leave requests
UPDATE public.leave_requests 
SET processed = true 
WHERE status = 'approved' 
  AND processed = false;

-- Step 6: Check results after processing
SELECT 'Results after processing:' as step;
SELECT 
  'Total Leaves Created' as metric,
  COUNT(*) as value
FROM public.leaves
UNION ALL
SELECT 
  'Paid Leaves' as metric,
  COUNT(*) as value
FROM public.leaves
WHERE is_paid_leave = true
UNION ALL
SELECT 
  'Unpaid Leaves' as metric,
  COUNT(*) as value
FROM public.leaves
WHERE is_paid_leave = false;

-- Step 7: Show detailed leaves created
SELECT 'Detailed leaves created:' as step;
SELECT 
  p.name,
  l.leave_date,
  l.leave_type_name,
  l.is_paid_leave,
  l.is_approved,
  l.notes
FROM public.profiles p
JOIN public.leaves l ON l.user_id = p.user_id
WHERE p.is_active = true
ORDER BY p.name, l.leave_date;

-- Step 8: Test work days configuration
SELECT 'Work days configuration after fix:' as step;
SELECT 
  p.name,
  ewd.monday,
  ewd.tuesday,
  ewd.wednesday,
  ewd.thursday,
  ewd.friday,
  ewd.saturday,
  ewd.sunday
FROM public.profiles p
LEFT JOIN public.employee_work_days ewd ON ewd.user_id = p.user_id
WHERE p.is_active = true
ORDER BY p.name;
