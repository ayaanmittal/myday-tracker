-- Create a comprehensive leaves tracking system
-- This migration creates a proper leaves table and functions to track paid/unpaid leaves

-- Step 1: Create leaves table to track all employee leaves
CREATE TABLE IF NOT EXISTS public.leaves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_date DATE NOT NULL,
  leave_type_id UUID REFERENCES public.leave_types(id),
  leave_type_name TEXT NOT NULL,
  is_paid_leave BOOLEAN NOT NULL DEFAULT true,
  is_approved BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  leave_request_id UUID REFERENCES public.leave_requests(id),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 2: Create indexes for better performance
CREATE INDEX idx_leaves_user_id ON public.leaves(user_id);
CREATE INDEX idx_leaves_leave_date ON public.leaves(leave_date);
CREATE INDEX idx_leaves_is_paid_leave ON public.leaves(is_paid_leave);
CREATE INDEX idx_leaves_user_date ON public.leaves(user_id, leave_date);

-- Step 3: Enable RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies
CREATE POLICY "Users can view their own leaves" ON public.leaves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all leaves" ON public.leaves
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Step 5: Create function to automatically populate leaves from approved leave requests
CREATE OR REPLACE FUNCTION public.populate_leaves_from_requests()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_leave_request RECORD;
  v_leave_date DATE;
  v_leave_type RECORD;
  v_leaves_created INTEGER := 0;
BEGIN
  -- Loop through all approved leave requests
  FOR v_leave_request IN
    SELECT 
      lr.id,
      lr.user_id,
      p.id as profile_id,
      lr.start_date,
      lr.end_date,
      lr.leave_type_id,
      lr.approved_by,
      lr.approved_at,
      lt.name as leave_type_name,
      lt.is_paid as is_paid_leave
    FROM public.leave_requests lr
    JOIN public.profiles p ON p.user_id = lr.user_id
    JOIN public.leave_types lt ON lt.id = lr.leave_type_id
    WHERE lr.status = 'approved'
      AND lr.processed = false
  LOOP
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
          created_by
        ) VALUES (
          v_leave_request.user_id,
          v_leave_request.profile_id,
          v_leave_date,
          v_leave_request.leave_type_id,
          v_leave_request.leave_type_name,
          v_leave_request.is_paid_leave,
          true,
          v_leave_request.approved_by,
          v_leave_request.approved_at,
          v_leave_request.id,
          v_leave_request.approved_by
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

-- Step 6: Create function to manually add leaves
CREATE OR REPLACE FUNCTION public.add_manual_leave(
  p_user_id UUID,
  p_leave_date DATE,
  p_leave_type_name TEXT,
  p_is_paid_leave BOOLEAN DEFAULT true,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_leave_id UUID;
  v_profile_id UUID;
BEGIN
  -- Get profile_id for the user
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user %', p_user_id;
  END IF;
  
  -- Insert manual leave
  INSERT INTO public.leaves (
    user_id,
    profile_id,
    leave_date,
    leave_type_name,
    is_paid_leave,
    is_approved,
    notes,
    created_by
  ) VALUES (
    p_user_id,
    v_profile_id,
    p_leave_date,
    p_leave_type_name,
    p_is_paid_leave,
    true,
    p_notes,
    COALESCE(p_created_by, auth.uid())
  ) RETURNING id INTO v_leave_id;
  
  RETURN v_leave_id;
END;
$$;

-- Step 7: Create function to calculate unpaid leave days for salary deduction
CREATE OR REPLACE FUNCTION public.calculate_unpaid_leave_days_for_salary(
  p_user_id UUID,
  p_payment_month DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_month_start DATE;
  v_month_end DATE;
  v_unpaid_days INTEGER := 0;
  v_work_days_config RECORD;
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_is_work_day BOOLEAN;
  v_has_unpaid_leave BOOLEAN;
BEGIN
  -- Get month boundaries
  v_month_start := p_payment_month;
  v_month_end := p_payment_month + INTERVAL '1 month' - INTERVAL '1 day';
  
  -- Get employee work days configuration
  SELECT * INTO v_work_days_config
  FROM public.employee_work_days
  WHERE user_id = p_user_id;
  
  -- If no work days configuration exists, use default (Mon-Fri)
  IF v_work_days_config IS NULL THEN
    v_work_days_config.monday := true;
    v_work_days_config.tuesday := true;
    v_work_days_config.wednesday := true;
    v_work_days_config.thursday := true;
    v_work_days_config.friday := true;
    v_work_days_config.saturday := false;
    v_work_days_config.sunday := false;
  END IF;
  
  -- Loop through each day in the month
  v_current_date := v_month_start;
  WHILE v_current_date <= v_month_end LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date); -- 0 = Sunday, 1 = Monday, etc.
    
    -- Determine if this is a work day
    v_is_work_day := CASE v_day_of_week
      WHEN 0 THEN v_work_days_config.sunday
      WHEN 1 THEN v_work_days_config.monday
      WHEN 2 THEN v_work_days_config.tuesday
      WHEN 3 THEN v_work_days_config.wednesday
      WHEN 4 THEN v_work_days_config.thursday
      WHEN 5 THEN v_work_days_config.friday
      WHEN 6 THEN v_work_days_config.saturday
    END;
    
    -- Only count work days
    IF v_is_work_day THEN
      -- Check if there's an unpaid leave for this date
      SELECT EXISTS(
        SELECT 1 FROM public.leaves 
        WHERE user_id = p_user_id 
          AND leave_date = v_current_date 
          AND is_paid_leave = false
          AND is_approved = true
      ) INTO v_has_unpaid_leave;
      
      IF v_has_unpaid_leave THEN
        v_unpaid_days := v_unpaid_days + 1;
      END IF;
    END IF;
    
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN v_unpaid_days;
END;
$$;

-- Step 8: Update the calculate_month_leave_deductions function to use the leaves table
DROP FUNCTION IF EXISTS public.calculate_month_leave_deductions(UUID, DATE);

CREATE OR REPLACE FUNCTION public.calculate_month_leave_deductions(
  p_user_id UUID,
  p_payment_month DATE
)
RETURNS TABLE(
  total_unpaid_days INTEGER,
  total_deduction_amount NUMERIC(12,2),
  daily_rate NUMERIC(12,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_daily_rate NUMERIC(12,2);
  v_unpaid_days INTEGER;
BEGIN
  -- Calculate daily rate
  v_daily_rate := calculate_daily_salary_rate(p_user_id, p_payment_month);
  
  -- Calculate unpaid leave days using the new function
  v_unpaid_days := calculate_unpaid_leave_days_for_salary(p_user_id, p_payment_month);
  
  -- Return the results
  RETURN QUERY SELECT
    v_unpaid_days as total_unpaid_days,
    (v_unpaid_days * v_daily_rate)::NUMERIC(12,2) as total_deduction_amount,
    v_daily_rate as daily_rate;
END;
$$;

-- Step 9: Create function to get employee leave summary
CREATE OR REPLACE FUNCTION public.get_employee_leave_summary(
  p_user_id UUID,
  p_payment_month DATE
)
RETURNS TABLE(
  total_leave_days INTEGER,
  paid_leave_days INTEGER,
  unpaid_leave_days INTEGER,
  leave_details JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_month_start DATE;
  v_month_end DATE;
BEGIN
  -- Get month boundaries
  v_month_start := p_payment_month;
  v_month_end := p_payment_month + INTERVAL '1 month' - INTERVAL '1 day';
  
  -- Return leave summary
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
          'notes', notes
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
    COALESCE(ls.details, '[]'::jsonb) as leave_details
  FROM leave_summary ls;
END;
$$;

-- Step 10: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.populate_leaves_from_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_manual_leave(UUID, DATE, TEXT, BOOLEAN, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_unpaid_leave_days_for_salary(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_month_leave_deductions(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_leave_summary(UUID, DATE) TO authenticated;

-- Step 11: Populate existing approved leave requests into leaves table
SELECT public.populate_leaves_from_requests();

-- Step 12: Test the new system
SELECT 'Test: New leaves tracking system' as step;
SELECT 
  p.name,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2024-01-01'::DATE) as unpaid_days,
  public.get_employee_leave_summary(p.user_id, '2024-01-01'::DATE) as leave_summary
FROM public.profiles p
WHERE p.is_active = true
LIMIT 5;

