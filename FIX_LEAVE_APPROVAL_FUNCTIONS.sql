-- Fix Leave Approval Functions
-- This script drops and recreates the functions to fix the column error

-- Step 1: Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.approve_leave_request(UUID, UUID);
DROP FUNCTION IF EXISTS public.reject_leave_request(UUID, UUID, TEXT);

-- Step 2: Create the approve_leave_request function with correct column name
CREATE OR REPLACE FUNCTION public.approve_leave_request(
  p_request_id UUID,
  p_approved_by UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_leave_request RECORD;
  v_current_date DATE;
  v_end_date DATE;
  v_inserted_count INTEGER := 0;
  v_result JSON;
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'Only admins can approve leave requests';
  END IF;

  -- Get the leave request details
  SELECT 
    lr.*,
    lt.name as leave_type_name,
    lt.is_paid as leave_type_is_paid,
    p.id as profile_id,
    p.employee_category_id
  INTO v_leave_request
  FROM public.leave_requests lr
  JOIN public.leave_types lt ON lt.id = lr.leave_type_id
  JOIN public.profiles p ON p.user_id = lr.user_id
  WHERE lr.id = p_request_id;

  -- Check if leave request exists
  IF v_leave_request.id IS NULL THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;

  -- Check if already approved
  IF v_leave_request.status = 'approved' THEN
    RAISE EXCEPTION 'Leave request is already approved';
  END IF;

  -- Update the leave request status
  UPDATE public.leave_requests 
  SET 
    status = 'approved',
    approved_by = p_approved_by,
    approved_at = now()
  WHERE id = p_request_id;

  -- Generate leave records for each day
  v_current_date := v_leave_request.start_date;
  v_end_date := v_leave_request.end_date;

  WHILE v_current_date <= v_end_date LOOP
    -- Check if leave already exists for this date
    IF NOT EXISTS (
      SELECT 1 FROM public.leaves 
      WHERE user_id = v_leave_request.user_id 
      AND leave_date = v_current_date
    ) THEN
      -- Insert leave record
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
      ) VALUES (
        v_leave_request.user_id,
        v_leave_request.profile_id,
        v_current_date,
        v_leave_request.leave_type_id,
        v_leave_request.leave_type_name,
        v_leave_request.leave_type_is_paid,
        true,
        p_approved_by,
        now(),
        p_request_id,
        p_approved_by,
        'Auto-generated from approved leave request'
      );
      
      v_inserted_count := v_inserted_count + 1;
    END IF;

    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  -- Return success result
  v_result := json_build_object(
    'success', true,
    'message', 'Leave request approved successfully',
    'inserted_leaves', v_inserted_count,
    'total_days', (v_end_date - v_leave_request.start_date + 1)
  );

  RETURN v_result;
END;
$$;

-- Step 3: Create the reject_leave_request function
CREATE OR REPLACE FUNCTION public.reject_leave_request(
  p_request_id UUID,
  p_rejected_by UUID,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'Only admins can reject leave requests';
  END IF;

  -- Update the leave request status
  UPDATE public.leave_requests 
  SET 
    status = 'rejected',
    approved_by = p_rejected_by,
    approved_at = now(),
    rejection_reason = p_rejection_reason
  WHERE id = p_request_id;

  -- Return success result
  v_result := json_build_object(
    'success', true,
    'message', 'Leave request rejected successfully'
  );

  RETURN v_result;
END;
$$;

-- Step 4: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.approve_leave_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_leave_request TO authenticated;

-- Step 5: Verify functions were created
SELECT 'Functions created successfully' as status;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('approve_leave_request', 'reject_leave_request');



