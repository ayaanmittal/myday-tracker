-- Test the holiday function step by step
-- This will help identify exactly where the issue is

-- Step 1: Check if we have active employees
DO $$
DECLARE
  v_employee_count INTEGER;
  v_employee_ids UUID[];
BEGIN
  SELECT COUNT(*), array_agg(id)
  INTO v_employee_count, v_employee_ids
  FROM public.profiles 
  WHERE COALESCE(is_active, TRUE) = TRUE;
  
  RAISE NOTICE 'Active employees: %', v_employee_count;
  RAISE NOTICE 'Employee IDs: %', v_employee_ids;
END $$;

-- Step 2: Test inserting into company_holidays
INSERT INTO public.company_holidays (holiday_date, title, created_by)
VALUES ('2025-11-15', 'Test Holiday', auth.uid())
ON CONFLICT (holiday_date) 
DO UPDATE SET 
  title = EXCLUDED.title,
  created_by = EXCLUDED.created_by,
  created_at = NOW();

-- Step 3: Test inserting into unified_attendance
INSERT INTO public.unified_attendance (
  user_id, entry_date, device_info, source, status, manual_status, modification_reason, manual_override_by, manual_override_at
)
SELECT 
  p.id as user_id,
  '2025-11-15'::DATE as entry_date,
  'System Override' as device_info,
  'manual' as source,
  'holiday' as status,
  'Office Holiday' as manual_status,
  'Test holiday override' as modification_reason,
  auth.uid() as manual_override_by,
  NOW() as manual_override_at
FROM public.profiles p
WHERE COALESCE(p.is_active, TRUE) = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.unified_attendance ua
    WHERE ua.user_id = p.id AND ua.entry_date = '2025-11-15'
  );

-- Step 4: Check results
SELECT 
  'Results' as test_type,
  (SELECT COUNT(*) FROM public.company_holidays WHERE holiday_date = '2025-11-15') as company_holidays_inserted,
  (SELECT COUNT(*) FROM public.unified_attendance WHERE entry_date = '2025-11-15' AND manual_status = 'Office Holiday') as attendance_inserted;
