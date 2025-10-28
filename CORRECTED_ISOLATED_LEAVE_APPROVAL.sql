-- Corrected Isolated Leave Approval System
-- Based on actual schema.md structure

-- Step 1: Create a simple, isolated approve function
CREATE OR REPLACE FUNCTION approve_leave_request_isolated(
  p_request_id uuid,
  p_approved_by uuid
)
RETURNS json AS $$
DECLARE
  request_record RECORD;
  profile_record RECORD;
  leave_type_record RECORD;
  loop_date date;
  days_created integer := 0;
BEGIN
  -- Get the leave request details with all fields from schema
  SELECT 
    id,
    user_id,
    leave_type_id,
    start_date,
    end_date,
    days_requested,
    reason,
    work_from_home,
    status,
    approved_by,
    approved_at,
    rejection_reason,
    created_at,
    updated_at,
    processed
  INTO request_record
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
  
  -- Get profile details with all fields from schema
  SELECT 
    id,
    name,
    email,
    team,
    is_active,
    created_at,
    updated_at,
    designation,
    teamoffice_employees_id,
    user_roles_id,
    user_id,
    auth_user_id,
    phone,
    address,
    joined_on_date,
    probation_period_months,
    employee_category_id,
    employee_category
  INTO profile_record
  FROM profiles
  WHERE user_id = request_record.user_id;
  
  -- Check if profile exists
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Employee profile not found');
  END IF;
  
  -- Get leave type details with all fields from schema
  SELECT 
    id,
    name,
    description,
    max_days_per_year,
    is_paid,
    requires_approval,
    is_active,
    created_at,
    updated_at
  INTO leave_type_record
  FROM leave_types
  WHERE id = request_record.leave_type_id;
  
  -- Check if leave type exists
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Leave type not found');
  END IF;
  
  -- Update the leave request with all fields from schema
  UPDATE leave_requests
  SET 
    status = 'approved',
    approved_by = p_approved_by,
    approved_at = now(),
    updated_at = now()
  WHERE id = p_request_id;
  
  -- Insert individual leave records for each day with all fields from schema
  loop_date := request_record.start_date;
  
  WHILE loop_date <= request_record.end_date LOOP
    -- Insert one row for each individual day with all required fields
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
      leave_type_record.name,
      leave_type_record.is_paid,
      true,
      p_approved_by,
      now(),
      p_request_id,
      request_record.reason,
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

-- Step 2: Create a simple, isolated reject function
CREATE OR REPLACE FUNCTION reject_leave_request_isolated(
  p_request_id uuid,
  p_rejected_by uuid,
  p_rejection_reason text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  request_record RECORD;
BEGIN
  -- Get the leave request details with all fields from schema
  SELECT 
    id,
    user_id,
    leave_type_id,
    start_date,
    end_date,
    days_requested,
    reason,
    work_from_home,
    status,
    approved_by,
    approved_at,
    rejection_reason,
    created_at,
    updated_at,
    processed
  INTO request_record
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
  
  -- Update the leave request with all fields from schema
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
GRANT EXECUTE ON FUNCTION approve_leave_request_isolated(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_leave_request_isolated(uuid, uuid, text) TO authenticated;

-- Step 4: Verify the functions exist
SELECT 'Corrected isolated leave approval functions created successfully!' as result;

