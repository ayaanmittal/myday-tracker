-- Simple Employee Category Fix
-- This script ensures the database has the correct structure after deleting employee_category column

-- Step 1: Verify current profiles table structure
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

-- Step 2: Ensure employee_category_id is properly populated
UPDATE public.profiles 
SET employee_category_id = (
  SELECT id FROM public.employee_categories 
  WHERE name = 'permanent' 
  LIMIT 1
)
WHERE employee_category_id IS NULL;

-- Step 3: Verify the fix
SELECT 'Verification - profiles with employee categories:' as step;
SELECT 
  p.id,
  p.name,
  p.employee_category_id,
  ec.name as category_name
FROM public.profiles p
LEFT JOIN public.employee_categories ec ON p.employee_category_id = ec.id
LIMIT 5;

-- Step 4: Check for any remaining issues
SELECT 'Check for null employee_category_id:' as step;
SELECT COUNT(*) as null_count
FROM public.profiles 
WHERE employee_category_id IS NULL;

