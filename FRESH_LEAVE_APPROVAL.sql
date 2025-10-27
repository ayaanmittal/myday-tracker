-- Fresh Leave Approval System
-- Simple, clean implementation based on exact schema.md structure

-- Step 1: Create a simple approve function
CREATE OR REPLACE FUNCTION approve_leave_request(
  p_request_id uuid,
  p_approved_by uuid
)
RETURNS json AS $$
DECLARE
  v_user_id uuid;
  v_leave_type_id uuid;
  v_start_date date;
  v_end_date date;
  v_reason text;
  v_profile_id uuid;
  v_leave_type_name text;
  v_is_paid boolean;
  v_current_date date;
  v_days_created integer := 0;
  v_joined_on_date date;
  v_probation_period_months integer;
  v_is_on_probation boolean := false;
BEGIN
  -- Step 1: Get leave request details
  SELECT 
    user_id,
    leave_type_id,
    start_date,
    end_date,
    reason
  INTO 
    v_user_id,
    v_leave_type_id,
    v_start_date,
    v_end_date,
    v_reason
  FROM leave_requests
  WHERE id = p_request_id;
  
  -- Check if request exists
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Leave request not found');
  END IF;
  
  -- Check if already processed
  IF EXISTS (
    SELECT 1 FROM leave_requests 
    WHERE id = p_request_id AND status != 'pending'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Leave request already processed');
  END IF;
  
  -- Step 2: Get profile details including probation info
  SELECT 
    id,
    joined_on_date,
    probation_period_months
  INTO 
    v_profile_id,
    v_joined_on_date,
    v_probation_period_months
  FROM profiles
  WHERE user_id = v_user_id;
  
  IF v_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Employee profile not found');
  END IF;
  
  -- Check if employee is on probation
  v_is_on_probation := (v_joined_on_date + INTERVAL '1 month' * v_probation_period_months) > CURRENT_DATE;
  
  -- Step 3: Get leave type details
  SELECT name, is_paid
  INTO v_leave_type_name, v_is_paid
  FROM leave_types
  WHERE id = v_leave_type_id;
  
  IF v_leave_type_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Leave type not found');
  END IF;
  
  -- Step 4: Update leave_requests table
  UPDATE leave_requests
  SET 
    status = 'approved',
    approved_by = p_approved_by,
    approved_at = now(),
    updated_at = now()
  WHERE id = p_request_id;
  
  -- Step 5: Insert individual leave records for each day
  v_current_date := v_start_date;
  
  WHILE v_current_date <= v_end_date LOOP
    INSERT INTO leaves (
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
      notes,
      created_by
    ) VALUES (
      v_user_id,
      v_profile_id,
      v_current_date,
      v_leave_type_id,
      v_leave_type_name,
      CASE 
        WHEN v_is_on_probation THEN false  -- Unpaid if on probation
        ELSE v_is_paid                     -- Use leave type default if not on probation
      END,
      true,
      p_approved_by,
      now(),
      p_request_id,
      v_reason,
      p_approved_by
    );
    
    v_days_created := v_days_created + 1;
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  
  -- Return success with probation info
  RETURN json_build_object(
    'success', true,
    'message', CASE 
      WHEN v_is_on_probation THEN 'Leave request approved successfully (unpaid due to probation)'
      ELSE 'Leave request approved successfully'
    END,
    'days_created', v_days_created,
    'is_on_probation', v_is_on_probation,
    'is_paid_leave', CASE 
      WHEN v_is_on_probation THEN false
      ELSE v_is_paid
    END
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Database error: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create a simple reject function
CREATE OR REPLACE FUNCTION reject_leave_request(
  p_request_id uuid,
  p_rejected_by uuid,
  p_rejection_reason text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_request_exists boolean;
BEGIN
  -- Check if request exists and is pending
  SELECT EXISTS(
    SELECT 1 FROM leave_requests 
    WHERE id = p_request_id AND status = 'pending'
  ) INTO v_request_exists;
  
  IF NOT v_request_exists THEN
    RETURN json_build_object('success', false, 'error', 'Leave request not found or already processed');
  END IF;
  
  -- Update leave_requests table
  UPDATE leave_requests
  SET 
    status = 'rejected',
    approved_by = p_rejected_by,
    approved_at = now(),
    rejection_reason = p_rejection_reason,
    updated_at = now()
  WHERE id = p_request_id;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Leave request rejected successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Database error: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION approve_leave_request(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_leave_request(uuid, uuid, text) TO authenticated;

-- Step 4: Verify functions created
SELECT 'Fresh leave approval functions created successfully!' as result;
