-- Complete Employee Category Fix
-- This script ensures both employee_category and employee_category_id are properly populated

-- Step 1: Check current state
SELECT 'Step 1: Check current profiles table structure' as step;
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND table_schema = 'public'
  AND column_name LIKE '%employee_category%'
ORDER BY column_name;

-- Step 2: Ensure employee_category column exists and is populated
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS employee_category TEXT;

-- Step 3: Populate employee_category from employee_categories table
UPDATE public.profiles 
SET employee_category = ec.name
FROM public.employee_categories ec
WHERE profiles.employee_category_id = ec.id
  AND (profiles.employee_category IS NULL OR profiles.employee_category = '');

-- Step 4: Set default values for any remaining null values
UPDATE public.profiles 
SET employee_category = 'permanent'
WHERE employee_category IS NULL OR employee_category = '';

-- Step 5: Ensure employee_category_id is populated for any missing values
UPDATE public.profiles 
SET employee_category_id = get_or_create_employee_category(employee_category)
WHERE employee_category_id IS NULL
  AND employee_category IS NOT NULL;

-- Step 6: Create a view to make the relationship explicit
CREATE OR REPLACE VIEW public.profiles_with_categories AS
SELECT 
  p.*,
  ec.name as employee_category_name,
  ec.is_paid_leave_eligible,
  ec.probation_period_months as category_probation_period
FROM public.profiles p
LEFT JOIN public.employee_categories ec ON p.employee_category_id = ec.id;

-- Step 7: Grant permissions on the view
GRANT SELECT ON public.profiles_with_categories TO authenticated;

-- Step 8: Verify the fix
SELECT 'Step 8: Verification - profiles with both columns:' as step;
SELECT 
  id,
  name,
  employee_category,
  employee_category_id,
  employee_category_name
FROM public.profiles_with_categories 
LIMIT 5;

-- Step 9: Check for any remaining issues
SELECT 'Step 9: Check for null values:' as step;
SELECT 
  COUNT(*) as total_profiles,
  COUNT(employee_category) as has_employee_category,
  COUNT(employee_category_id) as has_employee_category_id,
  COUNT(*) - COUNT(employee_category) as missing_employee_category,
  COUNT(*) - COUNT(employee_category_id) as missing_employee_category_id
FROM public.profiles;



