-- ADD MANUAL LEAVE FUNCTION SCRIPT
-- This will create a function to manually add leave records to the leaves table

-- Step 1: Drop existing function if it exists
DROP FUNCTION IF EXISTS public.add_manual_leave(UUID, DATE, TEXT, BOOLEAN, TEXT, UUID);

-- Step 2: Create function to add manual leave for employee
CREATE OR REPLACE FUNCTION public.add_manual_leave(
  p_user_id UUID,
  p_leave_date DATE,
  p_leave_type_name TEXT,
  p_is_paid_leave BOOLEAN DEFAULT false,
  p_reason TEXT DEFAULT NULL,
  p_approved_by UUID DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  leave_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_profile_id UUID;
  v_leave_type_id UUID;
  v_leave_id UUID;
  v_approved_by_id UUID;
BEGIN
  -- Get employee profile ID
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT false, 'Employee not found', NULL::UUID;
    RETURN;
  END IF;
  
  -- Get leave type ID
  SELECT id INTO v_leave_type_id
  FROM public.leave_types
  WHERE name = p_leave_type_name
    AND is_active = true;
  
  IF v_leave_type_id IS NULL THEN
    RETURN QUERY SELECT false, 'Leave type not found', NULL::UUID;
    RETURN;
  END IF;
  
  -- Get approved by user ID (default to current user if not provided)
  IF p_approved_by IS NULL THEN
    v_approved_by_id := auth.uid();
  ELSE
    v_approved_by_id := p_approved_by;
  END IF;
  
  -- Check if leave already exists for this date
  IF EXISTS (
    SELECT 1 FROM public.leaves 
    WHERE user_id = p_user_id 
      AND leave_date = p_leave_date
  ) THEN
    RETURN QUERY SELECT false, 'Leave already exists for this date', NULL::UUID;
    RETURN;
  END IF;
  
  -- Insert the leave record
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
    created_by,
    notes
  ) VALUES (
    p_user_id,
    v_profile_id,
    p_leave_date,
    v_leave_type_id,
    p_leave_type_name,
    p_is_paid_leave,
    true,
    v_approved_by_id,
    now(),
    v_approved_by_id,
    COALESCE(p_reason, 'Manually added leave')
  ) RETURNING id INTO v_leave_id;
  
  RETURN QUERY SELECT true, 'Leave added successfully', v_leave_id;
END;
$$;

-- Step 3: Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_available_leave_types();

-- Step 4: Create function to get available leave types
CREATE OR REPLACE FUNCTION public.get_available_leave_types()
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  is_paid BOOLEAN,
  max_days_per_year INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lt.id,
    lt.name,
    lt.description,
    lt.is_paid,
    lt.max_days_per_year
  FROM public.leave_types lt
  WHERE lt.is_active = true
  ORDER BY lt.name;
END;
$$;

-- Step 5: Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_employee_leave_summary(UUID, DATE, DATE);

-- Step 6: Create function to get employee leave summary
CREATE OR REPLACE FUNCTION public.get_employee_leave_summary(
  p_user_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  total_leaves INTEGER,
  paid_leaves INTEGER,
  unpaid_leaves INTEGER,
  leave_details JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  -- Set default date range if not provided
  IF p_start_date IS NULL THEN
    v_start_date := CURRENT_DATE - INTERVAL '1 month';
  ELSE
    v_start_date := p_start_date;
  END IF;
  
  IF p_end_date IS NULL THEN
    v_end_date := CURRENT_DATE + INTERVAL '1 month';
  ELSE
    v_end_date := p_end_date;
  END IF;
  
  RETURN QUERY
  WITH leave_summary AS (
    SELECT 
      COUNT(*) as total_days,
      COUNT(*) FILTER (WHERE is_paid_leave = true) as paid_days,
      COUNT(*) FILTER (WHERE is_paid_leave = false) as unpaid_days,
      jsonb_agg(
        jsonb_build_object(
          'leave_date', leave_date,
          'leave_type_name', leave_type_name,
          'is_paid_leave', is_paid_leave,
          'notes', notes,
          'approved_by', approved_by,
          'approved_at', approved_at
        )
      ) as details
    FROM public.leaves
    WHERE user_id = p_user_id
      AND leave_date BETWEEN v_start_date AND v_end_date
  )
  SELECT 
    COALESCE(ls.total_days, 0)::INTEGER as total_leaves,
    COALESCE(ls.paid_days, 0)::INTEGER as paid_leaves,
    COALESCE(ls.unpaid_days, 0)::INTEGER as unpaid_leaves,
    COALESCE(ls.details, '[]'::jsonb) as leave_details
  FROM leave_summary ls;
END;
$$;

-- Step 7: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.add_manual_leave(UUID, DATE, TEXT, BOOLEAN, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_leave_types() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_leave_summary(UUID, DATE, DATE) TO authenticated;

-- Step 8: Test the functions
SELECT 'Testing add_manual_leave function:' as step;
SELECT * FROM public.add_manual_leave(
  (SELECT user_id FROM public.profiles WHERE name ILIKE '%dolly%' LIMIT 1),
  '2025-10-15'::DATE,
  'Sick Leave',
  false,
  'Manual sick leave for testing',
  NULL
);

-- Step 9: Test get_available_leave_types function
SELECT 'Available leave types:' as step;
SELECT * FROM public.get_available_leave_types();

-- Step 10: Test get_employee_leave_summary function
SELECT 'Employee leave summary:' as step;
SELECT 
  p.name,
  public.get_employee_leave_summary(p.user_id, '2025-10-01'::DATE, '2025-10-31'::DATE) as leave_summary
FROM public.profiles p
WHERE p.is_active = true
ORDER BY p.name;
