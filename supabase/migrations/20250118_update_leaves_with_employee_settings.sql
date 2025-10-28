-- Update leaves table to automatically detect paid/unpaid status
-- based on employee leave settings and employee category

-- Step 1: Update the populate_leaves_from_requests function to use employee settings
DROP FUNCTION IF EXISTS public.populate_leaves_from_requests();

CREATE OR REPLACE FUNCTION public.populate_leaves_from_requests()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_leave_request RECORD;
  v_leave_date DATE;
  v_leave_type RECORD;
  v_employee_settings RECORD;
  v_leave_policy RECORD;
  v_is_paid_leave BOOLEAN;
  v_leaves_created INTEGER := 0;
BEGIN
  -- Loop through all approved leave requests
  FOR v_leave_request IN
    SELECT 
      lr.id,
      lr.user_id,
      p.id as profile_id,
      p.employee_category_id,
      lr.start_date,
      lr.end_date,
      lr.leave_type_id,
      lr.approved_by,
      lr.approved_at,
      lt.name as leave_type_name,
      lt.is_paid as default_is_paid
    FROM public.leave_requests lr
    JOIN public.profiles p ON p.user_id = lr.user_id
    JOIN public.leave_types lt ON lt.id = lr.leave_type_id
    WHERE lr.status = 'approved'
      AND lr.processed = false
  LOOP
    -- Get employee leave settings
    SELECT * INTO v_employee_settings
    FROM public.employee_leave_settings
    WHERE user_id = v_leave_request.user_id;
    
    -- Get leave policy for this employee category and leave type
    SELECT * INTO v_leave_policy
    FROM public.leave_policies lp
    WHERE lp.employee_category_id = v_leave_request.employee_category_id
      AND lp.leave_type_id = v_leave_request.leave_type_id
      AND lp.is_active = true;
    
    -- Determine if this is a paid leave
    v_is_paid_leave := true; -- Default to paid
    
    -- Check leave policy first
    IF v_leave_policy IS NOT NULL THEN
      v_is_paid_leave := v_leave_policy.is_paid;
    ELSE
      -- Fallback to leave type default
      v_is_paid_leave := v_leave_request.default_is_paid;
    END IF;
    
    -- Check if employee has custom leave settings that override
    IF v_employee_settings IS NOT NULL AND v_employee_settings.is_custom_settings = true THEN
      -- Check custom settings for this leave type
      IF v_employee_settings.custom_leave_days ? v_leave_request.leave_type_name THEN
        -- Custom setting exists, check if it's paid
        v_is_paid_leave := (v_employee_settings.custom_leave_days->v_leave_request.leave_type_name->>'is_paid')::boolean;
      END IF;
    END IF;
    
    -- Create leave records for each day in the leave period
    v_leave_date := v_leave_request.start_date;
    WHILE v_leave_date <= v_leave_request.end_date LOOP
      -- Check if leave record already exists for this date
      IF NOT EXISTS (
        SELECT 1 FROM public.leaves 
        WHERE user_id = v_leave_request.user_id 
          AND leave_date = v_leave_date
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
          v_leave_date,
          v_leave_request.leave_type_id,
          v_leave_request.leave_type_name,
          v_is_paid_leave,
          true,
          v_leave_request.approved_by,
          v_leave_request.approved_at,
          v_leave_request.id,
          v_leave_request.approved_by,
          'Auto-generated from approved leave request'
        );
        
        v_leaves_created := v_leaves_created + 1;
      END IF;
      
      v_leave_date := v_leave_date + INTERVAL '1 day';
    END LOOP;
    
    -- Mark the leave request as processed
    UPDATE public.leave_requests 
    SET processed = true 
    WHERE id = v_leave_request.id;
  END LOOP;
  
  RETURN v_leaves_created;
END;
$$;

-- Step 2: Create function to get leave policy for an employee and leave type
CREATE OR REPLACE FUNCTION public.get_leave_policy_for_employee(
  p_user_id UUID,
  p_leave_type_id UUID
)
RETURNS TABLE(
  is_paid BOOLEAN,
  max_days_per_year INTEGER,
  requires_approval BOOLEAN,
  policy_source TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_employee_category_id UUID;
  v_employee_settings RECORD;
  v_leave_policy RECORD;
  v_leave_type RECORD;
BEGIN
  -- Get employee category
  SELECT employee_category_id INTO v_employee_category_id
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  -- Get leave type information
  SELECT * INTO v_leave_type
  FROM public.leave_types
  WHERE id = p_leave_type_id;
  
  -- Get employee custom settings
  SELECT * INTO v_employee_settings
  FROM public.employee_leave_settings
  WHERE user_id = p_user_id;
  
  -- Check custom settings first
  IF v_employee_settings IS NOT NULL AND v_employee_settings.is_custom_settings = true THEN
    -- Check if custom setting exists for this leave type
    IF v_employee_settings.custom_leave_days ? v_leave_type.name THEN
      RETURN QUERY SELECT
        (v_employee_settings.custom_leave_days->v_leave_type.name->>'is_paid')::boolean as is_paid,
        (v_employee_settings.custom_leave_days->v_leave_type.name->>'max_days')::integer as max_days_per_year,
        (v_employee_settings.custom_leave_days->v_leave_type.name->>'requires_approval')::boolean as requires_approval,
        'custom_settings' as policy_source;
      RETURN;
    END IF;
  END IF;
  
  -- Check leave policy for employee category
  SELECT * INTO v_leave_policy
  FROM public.leave_policies
  WHERE employee_category_id = v_employee_category_id
    AND leave_type_id = p_leave_type_id
    AND is_active = true;
  
  IF v_leave_policy IS NOT NULL THEN
    RETURN QUERY SELECT
      v_leave_policy.is_paid as is_paid,
      v_leave_policy.max_days_per_year as max_days_per_year,
      v_leave_policy.requires_approval as requires_approval,
      'leave_policy' as policy_source;
  ELSE
    -- Fallback to leave type default
    RETURN QUERY SELECT
      v_leave_type.is_paid as is_paid,
      v_leave_type.max_days_per_year as max_days_per_year,
      v_leave_type.requires_approval as requires_approval,
      'leave_type_default' as policy_source;
  END IF;
END;
$$;

-- Step 3: Create function to update existing leaves with correct paid/unpaid status
CREATE OR REPLACE FUNCTION public.update_leaves_paid_status()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_leave RECORD;
  v_leave_policy RECORD;
  v_updated_count INTEGER := 0;
BEGIN
  -- Loop through all existing leaves
  FOR v_leave IN
    SELECT 
      l.id,
      l.user_id,
      l.leave_type_id,
      l.leave_type_name,
      l.is_paid_leave
    FROM public.leaves l
    WHERE l.leave_type_id IS NOT NULL
  LOOP
    -- Get the correct paid status for this leave
    SELECT * INTO v_leave_policy
    FROM public.get_leave_policy_for_employee(v_leave.user_id, v_leave.leave_type_id);
    
    -- Update if the status has changed
    IF v_leave_policy.is_paid != v_leave.is_paid_leave THEN
      UPDATE public.leaves
      SET 
        is_paid_leave = v_leave_policy.is_paid,
        updated_at = now()
      WHERE id = v_leave.id;
      
      v_updated_count := v_updated_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_updated_count;
END;
$$;

-- Step 4: Create function to get employee leave summary with policy details
CREATE OR REPLACE FUNCTION public.get_employee_leave_summary_with_policy(
  p_user_id UUID,
  p_payment_month DATE
)
RETURNS TABLE(
  total_leave_days INTEGER,
  paid_leave_days INTEGER,
  unpaid_leave_days INTEGER,
  leave_details JSONB,
  policy_summary JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_month_start DATE;
  v_month_end DATE;
  v_employee_category_id UUID;
  v_leave_policies JSONB;
BEGIN
  -- Get month boundaries
  v_month_start := p_payment_month;
  v_month_end := p_payment_month + INTERVAL '1 month' - INTERVAL '1 day';
  
  -- Get employee category
  SELECT employee_category_id INTO v_employee_category_id
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  -- Get leave policies for this employee category
  SELECT jsonb_agg(
    jsonb_build_object(
      'leave_type_id', lp.leave_type_id,
      'leave_type_name', lt.name,
      'is_paid', lp.is_paid,
      'max_days_per_year', lp.max_days_per_year,
      'requires_approval', lp.requires_approval
    )
  ) INTO v_leave_policies
  FROM public.leave_policies lp
  JOIN public.leave_types lt ON lt.id = lp.leave_type_id
  WHERE lp.employee_category_id = v_employee_category_id
    AND lp.is_active = true;
  
  -- Return leave summary with policy information
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
      AND leave_date BETWEEN v_month_start AND v_month_end
      AND is_approved = true
  )
  SELECT 
    COALESCE(ls.total_days, 0)::INTEGER as total_leave_days,
    COALESCE(ls.paid_days, 0)::INTEGER as paid_leave_days,
    COALESCE(ls.unpaid_days, 0)::INTEGER as unpaid_leave_days,
    COALESCE(ls.details, '[]'::jsonb) as leave_details,
    COALESCE(v_leave_policies, '[]'::jsonb) as policy_summary
  FROM leave_summary ls;
END;
$$;

-- Step 5: Create function to validate leave request against policies
CREATE OR REPLACE FUNCTION public.validate_leave_request(
  p_user_id UUID,
  p_leave_type_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(
  is_valid BOOLEAN,
  is_paid BOOLEAN,
  max_days_allowed INTEGER,
  days_requested INTEGER,
  policy_source TEXT,
  validation_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_policy RECORD;
  v_days_requested INTEGER;
  v_validation_message TEXT;
  v_is_valid BOOLEAN := true;
BEGIN
  -- Calculate days requested
  v_days_requested := p_end_date - p_start_date + 1;
  
  -- Get leave policy for this employee and leave type
  SELECT * INTO v_policy
  FROM public.get_leave_policy_for_employee(p_user_id, p_leave_type_id);
  
  -- Check if leave type is allowed
  IF v_policy.max_days_per_year = 0 THEN
    v_is_valid := false;
    v_validation_message := 'This leave type is not allowed for your employee category';
  ELSIF v_days_requested > v_policy.max_days_per_year THEN
    v_is_valid := false;
    v_validation_message := format('Requested %s days exceeds maximum %s days allowed per year', 
                                   v_days_requested, v_policy.max_days_per_year);
  END IF;
  
  -- Return validation results
  RETURN QUERY SELECT
    v_is_valid as is_valid,
    v_policy.is_paid as is_paid,
    v_policy.max_days_per_year as max_days_allowed,
    v_days_requested as days_requested,
    v_policy.policy_source as policy_source,
    v_validation_message as validation_message;
END;
$$;

-- Step 6: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.populate_leaves_from_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leave_policy_for_employee(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_leaves_paid_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_leave_summary_with_policy(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_leave_request(UUID, UUID, DATE, DATE) TO authenticated;

-- Step 7: Process all existing approved leave requests
SELECT 'Processing existing approved leave requests...' as step;
SELECT public.populate_leaves_from_requests() as leaves_created;

-- Step 8: Update existing leaves with correct paid/unpaid status
SELECT 'Updating existing leaves with correct paid/unpaid status...' as step;
SELECT public.update_leaves_paid_status() as leaves_updated;

-- Step 9: Test the new system
SELECT 'Testing the updated leaves system...' as step;
SELECT 
  p.name,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2024-01-01'::DATE) as unpaid_days,
  public.get_employee_leave_summary_with_policy(p.user_id, '2024-01-01'::DATE) as leave_summary
FROM public.profiles p
WHERE p.is_active = true
LIMIT 5;

