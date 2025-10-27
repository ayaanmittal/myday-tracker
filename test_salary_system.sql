-- Test script for salary management system
-- This script tests the salary management functionality

-- Step 1: Check if salary tables exist
SELECT 'Checking salary tables...' as test_step;

SELECT 
  table_name,
  CASE WHEN table_name IN ('employee_salaries', 'salary_payments', 'leave_deductions') 
    THEN '✅ Found' 
    ELSE '❌ Missing' 
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('employee_salaries', 'salary_payments', 'leave_deductions');

-- Step 2: Test adding a sample employee salary
SELECT 'Testing employee salary creation...' as test_step;

-- First, get a sample user
DO $$
DECLARE
    sample_user_id UUID;
    sample_profile_id UUID;
BEGIN
    -- Get a sample user and profile
    SELECT id INTO sample_user_id FROM auth.users LIMIT 1;
    SELECT id INTO sample_profile_id FROM public.profiles LIMIT 1;
    
    IF sample_user_id IS NOT NULL AND sample_profile_id IS NOT NULL THEN
        -- Insert a sample salary
        INSERT INTO public.employee_salaries (
            user_id,
            profile_id,
            base_salary,
            currency,
            salary_frequency,
            effective_from,
            is_active
        ) VALUES (
            sample_user_id,
            sample_profile_id,
            50000.00,
            'INR',
            'monthly',
            CURRENT_DATE,
            true
        ) ON CONFLICT (user_id, effective_from) WHERE is_active = true DO NOTHING;
        
        RAISE NOTICE 'Sample salary created for user: %', sample_user_id;
    ELSE
        RAISE NOTICE 'No users found to test with';
    END IF;
END $$;

-- Step 3: Test salary payment generation
SELECT 'Testing salary payment generation...' as test_step;

-- Generate payments for current month
SELECT * FROM generate_monthly_salary_payments(CURRENT_DATE);

-- Step 4: Test analytics function
SELECT 'Testing payroll analytics...' as test_step;

SELECT * FROM get_payroll_analytics(
    (CURRENT_DATE - INTERVAL '12 months')::DATE,
    CURRENT_DATE::DATE
);

-- Step 5: Test leave deduction calculation
SELECT 'Testing leave deduction calculation...' as test_step;

-- Get a sample user for testing
DO $$
DECLARE
    sample_user_id UUID;
    deduction_result RECORD;
BEGIN
    SELECT user_id INTO sample_user_id FROM public.employee_salaries LIMIT 1;
    
    IF sample_user_id IS NOT NULL THEN
        SELECT * INTO deduction_result 
        FROM calculate_month_leave_deductions(sample_user_id, CURRENT_DATE);
        
        RAISE NOTICE 'Leave deductions for user %: % unpaid days, % deduction amount', 
            sample_user_id, 
            deduction_result.total_unpaid_days, 
            deduction_result.total_deduction_amount;
    ELSE
        RAISE NOTICE 'No employees with salaries found';
    END IF;
END $$;

-- Step 6: Show current salary data
SELECT 'Current salary data summary:' as test_step;

SELECT 
    'Employee Salaries' as table_name,
    COUNT(*) as record_count,
    AVG(base_salary) as avg_salary,
    SUM(base_salary) as total_salary
FROM public.employee_salaries
WHERE is_active = true

UNION ALL

SELECT 
    'Salary Payments' as table_name,
    COUNT(*) as record_count,
    AVG(net_salary) as avg_salary,
    SUM(net_salary) as total_salary
FROM public.salary_payments

UNION ALL

SELECT 
    'Leave Deductions' as table_name,
    COUNT(*) as record_count,
    AVG(deduction_amount) as avg_salary,
    SUM(deduction_amount) as total_salary
FROM public.leave_deductions;

-- Step 7: Test payment status update
SELECT 'Testing payment status update...' as test_step;

-- Update a sample payment status
DO $$
DECLARE
    sample_payment_id UUID;
    update_result BOOLEAN;
BEGIN
    SELECT id INTO sample_payment_id FROM public.salary_payments LIMIT 1;
    
    IF sample_payment_id IS NOT NULL THEN
        SELECT update_salary_payment_status(
            sample_payment_id,
            true,
            'Bank Transfer',
            'TXN123456',
            'Test payment'
        ) INTO update_result;
        
        RAISE NOTICE 'Payment status update result: %', update_result;
    ELSE
        RAISE NOTICE 'No salary payments found to test with';
    END IF;
END $$;

-- Step 8: Final summary
SELECT 'Salary system test completed!' as test_step;
