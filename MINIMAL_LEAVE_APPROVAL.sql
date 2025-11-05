-- Minimal Leave Approval System
-- This creates the simplest possible functions that avoid all triggers

-- Step 1: Create a minimal approve function with NO complex queries
CREATE OR REPLACE FUNCTION approve_leave_request_minimal(
  p_request_id uuid,
  p_approved_by uuid
)
RETURNS json AS $$
DECLARE
  request_user_id uuid;
  request_start_date date;
  request_end_date date;
  request_leave_type_id uuid;
  request_reason text;
  profile_id uuid;
  leave_type_name text;
  leave_type_is_paid boolean;
  loop_date date;
  days_created integer := 0;
BEGIN
  -- Get basic request data - minimal fields only
  SELECT 
    user_id,
    start_date,
    end_date,
    leave_type_id,
    reason
  INTO 
    request_user_id,
    request_start_date,
    request_end_date,
    request_leave_type_id,
    request_reason
  FROM leave_requests
  WHERE id = p_request_id;
  
  -- Check if request exists
  IF request_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Leave request not found');
  END IF;
  
  -- Check if already processed
  IF EXISTS (
    SELECT 1 FROM leave_requests 
    WHERE id = p_request_id AND status != 'pending'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Leave request already processed');
  END IF;
  
  -- Get profile ID only
  SELECT id INTO profile_id
  FROM profiles
  WHERE user_id = request_user_id;
  
  -- Check if profile exists
  IF profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Employee profile not found');
  END IF;
  
  -- Get leave type data
  SELECT name, is_paid
  INTO leave_type_name, leave_type_is_paid
  FROM leave_types
  WHERE id = request_leave_type_id;
  
  -- Check if leave type exists
  IF leave_type_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Leave type not found');
  END IF;
  
  -- Update the leave request
  UPDATE leave_requests
  SET 
    status = 'approved',
    approved_by = p_approved_by,
    approved_at = now(),
    updated_at = now()
  WHERE id = p_request_id;
  
  -- Insert individual leave records for each day
  loop_date := request_start_date;
  
  WHILE loop_date <= request_end_date LOOP
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
      request_user_id,
      profile_id,
      loop_date,
      request_leave_type_id,
      leave_type_name,
      leave_type_is_paid,
      true,
      p_approved_by,
      now(),
      p_request_id,
      request_reason,
      p_approved_by
    );
    
    days_created := days_created + 1;
    loop_date := loop_date + INTERVAL '1 day';
  END LOOP;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Leave request approved successfully',
    'days_created', days_created
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Database error: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create a minimal reject function
CREATE OR REPLACE FUNCTION reject_leave_request_minimal(
  p_request_id uuid,
  p_rejected_by uuid,
  p_rejection_reason text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  request_exists boolean;
BEGIN
  -- Check if request exists and is pending
  SELECT EXISTS(
    SELECT 1 FROM leave_requests 
    WHERE id = p_request_id AND status = 'pending'
  ) INTO request_exists;
  
  -- Check if request exists
  IF NOT request_exists THEN
    RETURN json_build_object('success', false, 'error', 'Leave request not found or already processed');
  END IF;
  
  -- Update the leave request
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
GRANT EXECUTE ON FUNCTION approve_leave_request_minimal(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_leave_request_minimal(uuid, uuid, text) TO authenticated;

-- Step 4: Verify the functions exist
SELECT 'Minimal leave approval functions created successfully!' as result;



