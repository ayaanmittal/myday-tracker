-- Drop with CASCADE to handle dependencies
-- This script will drop all problematic functions and their dependent triggers

-- Step 1: Drop all triggers first
DROP TRIGGER IF EXISTS trigger_update_leave_balance ON leave_requests CASCADE;
DROP TRIGGER IF EXISTS auto_calculate_used_days_trigger ON leave_requests CASCADE;
DROP TRIGGER IF EXISTS auto_update_balances_trigger ON leave_requests CASCADE;
DROP TRIGGER IF EXISTS auto_mark_leave_granted_trigger ON leave_requests CASCADE;
DROP TRIGGER IF EXISTS update_leave_usage_trigger ON leave_requests CASCADE;
DROP TRIGGER IF EXISTS protect_leave_granted_trigger ON leaves CASCADE;
DROP TRIGGER IF EXISTS update_leaves_paid_status_trigger ON leaves CASCADE;
DROP TRIGGER IF EXISTS trigger_refresh_leave_balances ON leave_requests CASCADE;
DROP TRIGGER IF EXISTS auto_mark_attendance_based_on_work_days ON unified_attendance CASCADE;

-- Step 2: Drop all problematic functions with CASCADE
DROP FUNCTION IF EXISTS get_employee_leave_allocation(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS update_leave_balances_on_category_change() CASCADE;
DROP FUNCTION IF EXISTS rollover_leave_balances() CASCADE;
DROP FUNCTION IF EXISTS mark_leave_requests_processed() CASCADE;
DROP FUNCTION IF EXISTS update_leave_balance_on_request_change() CASCADE;
DROP FUNCTION IF EXISTS calculate_unpaid_leave_days_for_salary(uuid, date) CASCADE;
DROP FUNCTION IF EXISTS trigger_refresh_leave_balances() CASCADE;
DROP FUNCTION IF EXISTS auto_mark_leave_granted() CASCADE;
DROP FUNCTION IF EXISTS apply_approved_leaves_for_range(date, date) CASCADE;
DROP FUNCTION IF EXISTS get_employee_leave_summary(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS update_leave_usage() CASCADE;
DROP FUNCTION IF EXISTS calculate_month_leave_deductions(uuid, date) CASCADE;
DROP FUNCTION IF EXISTS protect_leave_granted() CASCADE;
DROP FUNCTION IF EXISTS calculate_unpaid_leave_days(uuid, date) CASCADE;
DROP FUNCTION IF EXISTS get_leave_policy_for_employee(uuid) CASCADE;
DROP FUNCTION IF EXISTS populate_leaves_from_requests() CASCADE;
DROP FUNCTION IF EXISTS update_leaves_paid_status() CASCADE;
DROP FUNCTION IF EXISTS get_employee_leave_summary_with_policy(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS validate_leave_request(uuid, uuid, date, date, integer) CASCADE;
DROP FUNCTION IF EXISTS get_available_leave_types(uuid) CASCADE;
DROP FUNCTION IF EXISTS add_manual_leave(uuid, uuid, date, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS get_employee_leaves_with_salary_deductions(uuid, date) CASCADE;

-- Step 3: Drop any other problematic functions
DROP FUNCTION IF EXISTS refresh_employee_leave_balances(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS auto_calculate_used_days() CASCADE;
DROP FUNCTION IF EXISTS leave_rollover() CASCADE;
DROP FUNCTION IF EXISTS auto_update_balances_trigger() CASCADE;
DROP FUNCTION IF EXISTS fix_user_id_mapping() CASCADE;
DROP FUNCTION IF EXISTS fix_interval_comparison() CASCADE;
DROP FUNCTION IF EXISTS fix_function_types() CASCADE;
DROP FUNCTION IF EXISTS fix_employee_id_column() CASCADE;
DROP FUNCTION IF EXISTS fix_user_id_constraint() CASCADE;
DROP FUNCTION IF EXISTS approve_leave_request(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS reject_leave_request(uuid, uuid, text) CASCADE;

-- Step 4: Create ONLY our clean functions
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

-- Step 5: Create the reject function
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

-- Step 6: Grant permissions
GRANT EXECUTE ON FUNCTION approve_leave_request_simple(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_leave_request_simple(uuid, uuid, text) TO authenticated;

-- Step 7: Verify cleanup
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%leave%'
ORDER BY routine_name;

-- Step 8: Check for any remaining triggers
SELECT 
  trigger_name,
  event_object_table
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY trigger_name;

-- Step 9: Final verification
SELECT 'All problematic functions and triggers dropped with CASCADE!' as result;

