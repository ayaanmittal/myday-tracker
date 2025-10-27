-- Clean Leave Approval Logic
-- Simple approach: Update leave_requests and insert into leaves table

-- Step 1: Create a simple function to approve leave requests
CREATE OR REPLACE FUNCTION approve_leave_request_simple(
  p_request_id uuid,
  p_approved_by uuid
)
RETURNS json AS $$
DECLARE
  request_record RECORD;
  profile_record RECORD;
  loop_date date;
  result json;
BEGIN
  -- Get the leave request details
  SELECT 
    lr.*,
    lt.name as leave_type_name,
    lt.is_paid as leave_type_is_paid
  INTO request_record
  FROM leave_requests lr
  JOIN leave_types lt ON lr.leave_type_id = lt.id
  WHERE lr.id = p_request_id;
  
  -- Check if request exists
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Leave request not found');
  END IF;
  
  -- Check if already processed
  IF request_record.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Leave request already processed');
  END IF;
  
  -- Get profile details
  SELECT id, name
  INTO profile_record
  FROM profiles
  WHERE user_id = request_record.user_id;
  
  -- Check if profile exists
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Employee profile not found');
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
  -- Each day gets its own row in the leaves table
  loop_date := request_record.start_date;
  
  WHILE loop_date <= request_record.end_date LOOP
    -- Insert one row for each individual day
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
      request_record.user_id,
      profile_record.id,
      loop_date,
      request_record.leave_type_id,
      request_record.leave_type_name,
      request_record.leave_type_is_paid,
      true,
      p_approved_by,
      now(),
      p_request_id,
      request_record.reason,
      p_approved_by
    );
    
    -- Move to the next day
    loop_date := loop_date + INTERVAL '1 day';
  END LOOP;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Leave request approved successfully',
    'days_created', request_record.days_requested
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Database error: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create a simple function to reject leave requests
CREATE OR REPLACE FUNCTION reject_leave_request_simple(
  p_request_id uuid,
  p_rejected_by uuid,
  p_rejection_reason text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  request_record RECORD;
  result json;
BEGIN
  -- Get the leave request details
  SELECT * INTO request_record
  FROM leave_requests
  WHERE id = p_request_id;
  
  -- Check if request exists
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Leave request not found');
  END IF;
  
  -- Check if already processed
  IF request_record.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Leave request already processed');
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
GRANT EXECUTE ON FUNCTION approve_leave_request_simple(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_leave_request_simple(uuid, uuid, text) TO authenticated;

-- Step 4: Test the functions
SELECT 'Functions created successfully!' as result;
