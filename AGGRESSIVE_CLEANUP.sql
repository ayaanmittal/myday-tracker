-- Aggressive Cleanup - Remove ALL references to employee_category column
-- This script will find and remove ALL problematic functions and triggers

-- Step 1: Find all functions that reference the old column
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition LIKE '%employee_category%'
  AND routine_definition NOT LIKE '%employee_category_id%';

-- Step 2: Drop ALL functions that might be problematic
DROP FUNCTION IF EXISTS refresh_employee_leave_balances(INTEGER);
DROP FUNCTION IF EXISTS auto_calculate_used_days();
DROP FUNCTION IF EXISTS leave_rollover();
DROP FUNCTION IF EXISTS auto_update_balances_trigger();
DROP FUNCTION IF EXISTS fix_user_id_mapping();
DROP FUNCTION IF EXISTS fix_interval_comparison();
DROP FUNCTION IF EXISTS fix_function_types();
DROP FUNCTION IF EXISTS fix_employee_id_column();
DROP FUNCTION IF EXISTS fix_user_id_constraint();
DROP FUNCTION IF EXISTS approve_leave_request(uuid, uuid);
DROP FUNCTION IF EXISTS reject_leave_request(uuid, uuid, text);
DROP FUNCTION IF EXISTS approve_leave_request_simple(uuid, uuid);
DROP FUNCTION IF EXISTS reject_leave_request_simple(uuid, uuid, text);

-- Step 3: Drop ALL triggers
DROP TRIGGER IF EXISTS auto_calculate_used_days_trigger ON leave_requests;
DROP TRIGGER IF EXISTS auto_update_balances_trigger ON leave_requests;
DROP TRIGGER IF EXISTS auto_mark_attendance_based_on_work_days ON unified_attendance;

-- Step 4: Drop ALL views that might reference the old column
DROP VIEW IF EXISTS profiles_with_categories CASCADE;

-- Step 5: Create ONLY the essential clean functions
CREATE OR REPLACE FUNCTION approve_leave_request_simple(
  p_request_id uuid,
  p_approved_by uuid
)
RETURNS json AS $$
DECLARE
  request_record RECORD;
  profile_record RECORD;
  loop_date date;
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
  
  -- Get profile details - NO JOINS, just basic profile data
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
  loop_date := request_record.start_date;
  
  WHILE loop_date <= request_record.end_date LOOP
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

-- Step 6: Create the reject function
CREATE OR REPLACE FUNCTION reject_leave_request_simple(
  p_request_id uuid,
  p_rejected_by uuid,
  p_rejection_reason text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  request_record RECORD;
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

-- Step 7: Grant permissions
GRANT EXECUTE ON FUNCTION approve_leave_request_simple(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_leave_request_simple(uuid, uuid, text) TO authenticated;

-- Step 8: Verify no problematic functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%leave%'
ORDER BY routine_name;

-- Step 9: Final verification
SELECT 'Aggressive cleanup completed!' as result;



