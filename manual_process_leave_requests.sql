-- Manual processing of approved leave requests into leaves table
-- This script manually creates leave records for all approved leave requests

-- Step 1: Check if leaves table exists, if not create it
CREATE TABLE IF NOT EXISTS public.leaves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_date DATE NOT NULL,
  leave_type_id UUID REFERENCES public.leave_types(id),
  leave_type_name TEXT NOT NULL,
  is_paid_leave BOOLEAN NOT NULL DEFAULT true,
  is_approved BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  leave_request_id UUID REFERENCES public.leave_requests(id),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 2: Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_leaves_user_id ON public.leaves(user_id);
CREATE INDEX IF NOT EXISTS idx_leaves_leave_date ON public.leaves(leave_date);
CREATE INDEX IF NOT EXISTS idx_leaves_is_paid_leave ON public.leaves(is_paid_leave);
CREATE INDEX IF NOT EXISTS idx_leaves_user_date ON public.leaves(user_id, leave_date);

-- Step 3: Enable RLS if not already enabled
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'leaves' 
    AND policyname = 'Users can view their own leaves'
  ) THEN
    CREATE POLICY "Users can view their own leaves" ON public.leaves
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'leaves' 
    AND policyname = 'Admins can manage all leaves'
  ) THEN
    CREATE POLICY "Admins can manage all leaves" ON public.leaves
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() 
          AND role IN ('admin', 'manager')
        )
      );
  END IF;
END $$;

-- Step 5: Check current state
SELECT 'Current state before processing' as step;
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

-- Step 6: Process approved leave requests manually
-- For each approved leave request, create leave records for each day
WITH approved_requests AS (
  SELECT 
    lr.id as request_id,
    lr.user_id,
    p.id as profile_id,
    p.employee_category_id,
    lr.start_date,
    lr.end_date,
    lr.leave_type_id,
    lr.approved_by,
    lr.approved_at,
    lt.name as leave_type_name,
    lt.is_paid as leave_type_default_paid
  FROM public.leave_requests lr
  JOIN public.profiles p ON p.user_id = lr.user_id
  JOIN public.leave_types lt ON lt.id = lr.leave_type_id
  WHERE lr.status = 'approved'
    AND lr.processed = false
),
leave_days AS (
  SELECT 
    ar.request_id,
    ar.user_id,
    ar.profile_id,
    ar.employee_category_id,
    ar.leave_type_id,
    ar.leave_type_name,
    ar.approved_by,
    ar.approved_at,
    ar.leave_type_default_paid,
    generate_series(ar.start_date, ar.end_date, '1 day'::interval)::date as leave_date
  FROM approved_requests ar
),
leave_policies AS (
  SELECT 
    ld.*,
    lp.is_paid as policy_is_paid
  FROM leave_days ld
  LEFT JOIN public.leave_policies lp ON lp.employee_category_id = ld.employee_category_id
    AND lp.leave_type_id = ld.leave_type_id
    AND lp.is_active = true
),
final_leaves AS (
  SELECT 
    lp.*,
    CASE 
      WHEN lp.policy_is_paid IS NOT NULL THEN lp.policy_is_paid
      ELSE lp.leave_type_default_paid
    END as final_is_paid
  FROM leave_policies lp
)
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
  fl.user_id,
  fl.profile_id,
  fl.leave_date,
  fl.leave_type_id,
  fl.leave_type_name,
  fl.final_is_paid,
  true,
  fl.approved_by,
  fl.approved_at,
  fl.request_id,
  fl.approved_by,
  'Auto-generated from approved leave request'
FROM final_leaves fl
WHERE NOT EXISTS (
  SELECT 1 FROM public.leaves l 
  WHERE l.user_id = fl.user_id 
    AND l.leave_date = fl.leave_date
);

-- Step 7: Mark processed leave requests
UPDATE public.leave_requests 
SET processed = true 
WHERE status = 'approved' 
  AND processed = false;

-- Step 8: Check results after processing
SELECT 'Results after processing' as step;
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

-- Step 9: Show detailed leaves created
SELECT 'Detailed leaves created' as step;
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

-- Step 10: Test unpaid leave calculation
SELECT 'Unpaid leave calculation test' as step;
SELECT 
  p.name,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2024-01-01'::DATE) as unpaid_days
FROM public.profiles p
WHERE p.is_active = true
ORDER BY p.name;
