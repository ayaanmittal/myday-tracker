-- Debug My Leaves & Salary Page Issues
-- This script checks what's missing and fixes the issues

-- Step 1: Check if required tables exist
SELECT 'Step 1: Check required tables' as step;

SELECT 
  table_name,
  table_schema
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('leaves', 'employee_salaries', 'company_holidays', 'leave_types')
ORDER BY table_name;

-- Step 2: Check if required functions exist
SELECT 'Step 2: Check required functions' as step;

SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'get_employee_leaves_with_salary_deductions',
    'get_employee_salary_summary'
  )
ORDER BY routine_name;

-- Step 3: Create missing tables if they don't exist
SELECT 'Step 3: Create missing tables' as step;

-- Create leaves table if it doesn't exist
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

-- Create employee_salaries table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.employee_salaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_salary NUMERIC(12,2) NOT NULL CHECK (base_salary >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  salary_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (salary_frequency IN ('monthly', 'weekly', 'daily')),
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT check_effective_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Create company_holidays table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.company_holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  title TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Step 4: Create sample data for testing
SELECT 'Step 4: Create sample data' as step;

-- Insert sample employee salary
INSERT INTO public.employee_salaries (
  user_id, 
  profile_id, 
  base_salary, 
  effective_from, 
  is_active
)
SELECT 
  p.id as user_id,
  p.id as profile_id,
  50000 as base_salary,
  '2025-01-01'::DATE as effective_from,
  true as is_active
FROM public.profiles p
WHERE p.name ILIKE '%dolly%'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Insert sample company holidays
INSERT INTO public.company_holidays (holiday_date, title)
VALUES 
  ('2025-02-12', 'Office Holiday 1'),
  ('2025-02-13', 'Office Holiday 2')
ON CONFLICT (holiday_date) DO NOTHING;

-- Step 5: Test the functions
SELECT 'Step 5: Test functions' as step;

-- Test get_employee_leaves_with_salary_deductions
SELECT 'Testing get_employee_leaves_with_salary_deductions' as test;
SELECT * FROM public.get_employee_leaves_with_salary_deductions(
  (SELECT id FROM public.profiles WHERE name ILIKE '%dolly%' LIMIT 1),
  '2025-02-01'::DATE
);

-- Test get_employee_salary_summary
SELECT 'Testing get_employee_salary_summary' as test;
SELECT * FROM public.get_employee_salary_summary(
  (SELECT id FROM public.profiles WHERE name ILIKE '%dolly%' LIMIT 1),
  '2025-02-01'::DATE
);

-- Step 6: Check for any errors
SELECT 'Step 6: Check for errors' as step;
SELECT 
  'Tables created successfully' as status,
  COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('leaves', 'employee_salaries', 'company_holidays');
