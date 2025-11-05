-- Fix Employee Category References
-- This script ensures the database schema matches what the frontend expects

-- Step 1: Check current profiles table structure
SELECT 'Current profiles table structure:' as step;
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND table_schema = 'public'
  AND column_name LIKE '%employee_category%'
ORDER BY column_name;

-- Step 2: Add employee_category column if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS employee_category TEXT;

-- Step 3: Populate employee_category from employee_categories table
UPDATE public.profiles 
SET employee_category = ec.name
FROM public.employee_categories ec
WHERE profiles.employee_category_id = ec.id
  AND profiles.employee_category IS NULL;

-- Step 4: Set default value for any remaining null values
UPDATE public.profiles 
SET employee_category = 'permanent'
WHERE employee_category IS NULL;

-- Step 5: Make employee_category NOT NULL
ALTER TABLE public.profiles 
ALTER COLUMN employee_category SET NOT NULL;

-- Step 6: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_employee_category 
ON public.profiles(employee_category);

-- Step 7: Verify the fix
SELECT 'Verification - profiles with employee_category:' as step;
SELECT 
  id,
  name,
  employee_category,
  employee_category_id
FROM public.profiles 
LIMIT 5;

-- Step 8: Check if there are any remaining issues
SELECT 'Check for any remaining null values:' as step;
SELECT COUNT(*) as null_count
FROM public.profiles 
WHERE employee_category IS NULL;



