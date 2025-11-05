-- Final Employee Category Fix
-- This script creates the missing view and ensures proper data flow

-- Step 1: Create the profiles_with_categories view
CREATE OR REPLACE VIEW public.profiles_with_categories AS
SELECT 
  p.*,
  ec.name as employee_category_name,
  ec.is_paid_leave_eligible,
  ec.probation_period_months as category_probation_period
FROM public.profiles p
LEFT JOIN public.employee_categories ec ON p.employee_category_id = ec.id;

-- Step 2: Grant permissions on the view
GRANT SELECT ON public.profiles_with_categories TO authenticated;

-- Step 3: Ensure employee_category column is populated from employee_categories
UPDATE public.profiles 
SET employee_category = ec.name
FROM public.employee_categories ec
WHERE profiles.employee_category_id = ec.id
  AND (profiles.employee_category IS NULL OR profiles.employee_category = '');

-- Step 4: Set default values for any remaining null values
UPDATE public.profiles 
SET employee_category = 'permanent'
WHERE employee_category IS NULL OR employee_category = '';

-- Step 5: Verify the fix
SELECT 'Verification - profiles with categories:' as step;
SELECT 
  id,
  name,
  employee_category,
  employee_category_id,
  employee_category_name
FROM public.profiles_with_categories 
LIMIT 5;

-- Step 6: Check for any remaining issues
SELECT 'Check for null values:' as step;
SELECT 
  COUNT(*) as total_profiles,
  COUNT(employee_category) as has_employee_category,
  COUNT(employee_category_id) as has_employee_category_id,
  COUNT(*) - COUNT(employee_category) as missing_employee_category,
  COUNT(*) - COUNT(employee_category_id) as missing_employee_category_id
FROM public.profiles;



