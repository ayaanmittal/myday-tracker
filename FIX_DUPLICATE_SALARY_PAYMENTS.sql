-- FIX DUPLICATE SALARY PAYMENTS ERROR
-- This script fixes the generate_monthly_salary_payments function to handle existing records

-- Step 1: Check the unique constraint
SELECT 
  'Unique Constraints on salary_payments' as info,
  constraint_name,
  constraint_type,
  column_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'salary_payments'
  AND tc.constraint_type = 'UNIQUE';

-- Step 2: Check existing salary payments for October 2025
SELECT 
  'Existing salary payments for October 2025' as info,
  user_id,
  payment_month,
  base_salary,
  net_salary,
  created_at
FROM public.salary_payments
WHERE payment_month = '2025-10-01'
ORDER BY created_at DESC;

-- Step 3: Create updated function that handles existing records
CREATE OR REPLACE FUNCTION public.generate_monthly_salary_payments(
  p_payment_month DATE,
  p_processed_by UUID DEFAULT NULL
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
  -- Loop through all active employees
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
  LOOP
    -- Check if payment already exists for this user and month
    SELECT id INTO v_existing_payment_id
    FROM public.salary_payments
    WHERE user_id = v_user_record.user_id
      AND payment_month = p_payment_month;
    
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

-- Step 4: Test the updated function
SELECT 
  'Testing updated generate_monthly_salary_payments' as info,
  *
FROM public.generate_monthly_salary_payments('2025-10-01'::DATE);

-- Step 5: Check the results
SELECT 
  'Updated salary payments for October 2025' as info,
  user_id,
  payment_month,
  base_salary,
  net_salary,
  leave_deductions,
  unpaid_leave_days,
  updated_at
FROM public.salary_payments
WHERE payment_month = '2025-10-01'
ORDER BY updated_at DESC;

-- Step 6: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_monthly_salary_payments(DATE, UUID) TO authenticated;



