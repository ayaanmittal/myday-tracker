-- COMPLETE SALARY FIX FINAL
-- This script creates both functions and fixes all salary generation issues

-- Step 1: Clean up existing October 2025 payments to avoid duplicates
DELETE FROM public.salary_payments 
WHERE payment_month = '2025-10-01';

-- Step 2: Create the calculate_month_leave_deductions function
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
  v_work_days_config RECORD;
  v_work_days_in_month INTEGER := 0;
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_is_work_day BOOLEAN;
  v_month_start DATE;
  v_month_end DATE;
  v_total_days_in_month INTEGER := 0;
  v_base_salary NUMERIC(12,2) := 0;
  v_daily_rate NUMERIC(12,2) := 0;
  v_unpaid_days INTEGER := 0;
  v_leave_deduction NUMERIC(12,2) := 0;
  v_leave_record RECORD;
  v_is_office_holiday BOOLEAN;
  v_is_sunday BOOLEAN;
BEGIN
  -- Get month boundaries
  v_month_start := p_payment_month;
  v_month_end := p_payment_month + INTERVAL '1 month' - INTERVAL '1 day';
  
  -- Calculate total days in month (for daily rate calculation)
  v_total_days_in_month := EXTRACT(DAY FROM v_month_end);
  
  -- Get employee base salary
  SELECT es.base_salary INTO v_base_salary
  FROM public.employee_salaries es
  WHERE es.user_id = p_user_id
    AND es.is_active = true
    AND es.effective_from <= v_month_end
    AND (es.effective_to IS NULL OR es.effective_to >= v_month_start)
  ORDER BY es.effective_from DESC
  LIMIT 1;
  
  -- If no salary found, return zero values
  IF v_base_salary IS NULL OR v_base_salary = 0 THEN
    RETURN QUERY SELECT
      0,
      0::NUMERIC(12,2),
      0::NUMERIC(12,2);
    RETURN;
  END IF;
  
  -- Get employee work days configuration
  SELECT * INTO v_work_days_config
  FROM public.employee_work_days ewd
  WHERE ewd.user_id = p_user_id;
  
  -- If no work days configuration exists, use default (Mon-Sat)
  IF v_work_days_config IS NULL THEN
    v_work_days_config.monday := true;
    v_work_days_config.tuesday := true;
    v_work_days_config.wednesday := true;
    v_work_days_config.thursday := true;
    v_work_days_config.friday := true;
    v_work_days_config.saturday := true;
    v_work_days_config.sunday := false;
  END IF;
  
  -- Calculate work days in the month (for display purposes)
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
    
    IF v_is_work_day THEN
      v_work_days_in_month := v_work_days_in_month + 1;
    END IF;
    
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  
  -- Calculate daily rate based on total days in month (since office holidays and Sundays are paid)
  v_daily_rate := v_base_salary / v_total_days_in_month;
  
  -- Count unpaid leave days from the leaves table
  FOR v_leave_record IN
    SELECT 
      l.leave_date,
      l.is_paid_leave,
      l.is_approved
    FROM public.leaves l
    WHERE l.user_id = p_user_id
      AND l.leave_date BETWEEN v_month_start AND v_month_end
      AND l.is_paid_leave = false  -- Only unpaid leaves
      AND l.is_approved = true     -- Only approved leaves
  LOOP
    -- Check if this date is a work day
    v_day_of_week := EXTRACT(DOW FROM v_leave_record.leave_date);
    v_is_work_day := CASE v_day_of_week
      WHEN 0 THEN v_work_days_config.sunday
      WHEN 1 THEN v_work_days_config.monday
      WHEN 2 THEN v_work_days_config.tuesday
      WHEN 3 THEN v_work_days_config.wednesday
      WHEN 4 THEN v_work_days_config.thursday
      WHEN 5 THEN v_work_days_config.friday
      WHEN 6 THEN v_work_days_config.saturday
    END;
    
    -- Check if this date is an office holiday
    SELECT EXISTS(
      SELECT 1 FROM public.company_holidays ch
      WHERE ch.holiday_date = v_leave_record.leave_date
    ) INTO v_is_office_holiday;
    
    -- Check if this date is a Sunday
    v_is_sunday := (v_day_of_week = 0);
    
    -- Only count as unpaid if it's a work day AND not an office holiday AND not a Sunday
    IF v_is_work_day AND NOT v_is_office_holiday AND NOT v_is_sunday THEN
      v_unpaid_days := v_unpaid_days + 1;
    END IF;
  END LOOP;
  
  -- Calculate leave deduction
  v_leave_deduction := v_daily_rate * v_unpaid_days;
  
  -- Return the results
  RETURN QUERY SELECT
    v_unpaid_days,
    v_leave_deduction,
    v_daily_rate;
END;
$$;

-- Step 3: Create the generate_monthly_salary_payments function with proper column qualification
CREATE OR REPLACE FUNCTION public.generate_monthly_salary_payments(
  p_payment_month DATE,
  p_processed_by UUID DEFAULT NULL,
  p_selected_employees UUID[] DEFAULT NULL
)
RETURNS TABLE(
  user_id UUID,
  profile_id UUID,
  employee_name TEXT,
  base_salary NUMERIC(12,2),
  gross_salary NUMERIC(12,2),
  leave_deductions NUMERIC(12,2),
  unpaid_leave_days INTEGER,
  net_salary NUMERIC(12,2),
  payment_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_record RECORD;
  v_leave_deduction RECORD;
  v_payment_id UUID;
  v_existing_payment_id UUID;
BEGIN
  -- Loop through selected employees only
  FOR v_user_record IN
    SELECT 
      p.id as profile_id,
      p.user_id,
      p.name as employee_name,
      es.base_salary
    FROM public.profiles p
    JOIN public.employee_salaries es ON es.profile_id = p.id
    WHERE p.is_active = true
      AND es.is_active = true
      AND es.effective_from <= p_payment_month
      AND (es.effective_to IS NULL OR es.effective_to >= p_payment_month)
      AND (p_selected_employees IS NULL OR p.user_id = ANY(p_selected_employees))
  LOOP
    -- Check if payment already exists for this user and month
    -- Fixed: Use table alias to avoid ambiguous reference
    SELECT sp.id INTO v_existing_payment_id
    FROM public.salary_payments sp
    WHERE sp.user_id = v_user_record.user_id
      AND sp.payment_month = p_payment_month;
    
    -- Calculate leave deductions
    SELECT * INTO v_leave_deduction
    FROM calculate_month_leave_deductions(v_user_record.user_id, p_payment_month);
    
    IF v_existing_payment_id IS NOT NULL THEN
      -- Update existing payment
      UPDATE public.salary_payments SET
        base_salary = v_user_record.base_salary,
        gross_salary = v_user_record.base_salary,
        leave_deductions = COALESCE(v_leave_deduction.total_deduction_amount, 0),
        unpaid_leave_days = COALESCE(v_leave_deduction.total_unpaid_days, 0),
        deduction_percentage = CASE 
          WHEN v_user_record.base_salary > 0 THEN 
            (COALESCE(v_leave_deduction.total_deduction_amount, 0) / v_user_record.base_salary * 100)
          ELSE 0 
        END,
        net_salary = v_user_record.base_salary - COALESCE(v_leave_deduction.total_deduction_amount, 0),
        processed_by = p_processed_by,
        updated_at = now()
      WHERE id = v_existing_payment_id;
      
      v_payment_id := v_existing_payment_id;
    ELSE
      -- Create new payment record
      INSERT INTO public.salary_payments (
        user_id,
        profile_id,
        payment_month,
        base_salary,
        gross_salary,
        leave_deductions,
        unpaid_leave_days,
        deduction_percentage,
        net_salary,
        processed_by
      ) VALUES (
        v_user_record.user_id,
        v_user_record.profile_id,
        p_payment_month,
        v_user_record.base_salary,
        v_user_record.base_salary,
        COALESCE(v_leave_deduction.total_deduction_amount, 0),
        COALESCE(v_leave_deduction.total_unpaid_days, 0),
        CASE 
          WHEN v_user_record.base_salary > 0 THEN 
            (COALESCE(v_leave_deduction.total_deduction_amount, 0) / v_user_record.base_salary * 100)
          ELSE 0 
        END,
        v_user_record.base_salary - COALESCE(v_leave_deduction.total_deduction_amount, 0),
        p_processed_by
      )
      RETURNING id INTO v_payment_id;
    END IF;
    
    -- Return the generated/updated payment info
    RETURN QUERY SELECT
      v_user_record.user_id,
      v_user_record.profile_id,
      v_user_record.employee_name,
      v_user_record.base_salary,
      v_user_record.base_salary,
      COALESCE(v_leave_deduction.total_deduction_amount, 0),
      COALESCE(v_leave_deduction.total_unpaid_days, 0),
      v_user_record.base_salary - COALESCE(v_leave_deduction.total_deduction_amount, 0),
      v_payment_id;
  END LOOP;
END;
$$;

-- Step 4: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_month_leave_deductions(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_monthly_salary_payments(DATE, UUID) TO authenticated;

-- Step 5: Test the calculate_month_leave_deductions function
SELECT 
  'Testing calculate_month_leave_deductions for Dolly Jhamb' as test_step,
  *
FROM public.calculate_month_leave_deductions(
  (SELECT id FROM public.profiles WHERE name = 'Dolly Jhamb' LIMIT 1),
  '2025-10-01'::DATE
);

-- Step 6: Test the generate_monthly_salary_payments function
SELECT 
  'Testing generate_monthly_salary_payments' as test_step,
  COUNT(*) as generated_payments
FROM public.generate_monthly_salary_payments('2025-10-01'::DATE, NULL, NULL);

-- Step 7: Check the results
SELECT 
  'Generated salary payments' as test_step,
  sp.user_id,
  p.name,
  sp.base_salary,
  sp.net_salary,
  sp.leave_deductions,
  sp.unpaid_leave_days,
  sp.created_at
FROM public.salary_payments sp
JOIN public.profiles p ON p.user_id = sp.user_id
WHERE sp.payment_month = '2025-10-01'
ORDER BY p.name;
