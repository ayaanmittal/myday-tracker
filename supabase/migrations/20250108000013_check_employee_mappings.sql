-- Check employee mappings to see if they're properly set up

-- Create function to analyze employee mappings
CREATE OR REPLACE FUNCTION public.analyze_employee_mappings()
RETURNS TABLE (
  analysis_type TEXT,
  count_value BIGINT,
  details TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Count total mappings
  RETURN QUERY
  SELECT 
    'Total employee mappings'::TEXT,
    COUNT(*)::BIGINT,
    'All mappings in employee_mappings table'::TEXT
  FROM employee_mappings;
  
  -- Count active mappings
  RETURN QUERY
  SELECT 
    'Active mappings'::TEXT,
    COUNT(*)::BIGINT,
    'Mappings where is_active = true'::TEXT
  FROM employee_mappings 
  WHERE is_active = true;
  
  -- Count mappings with our_user_id
  RETURN QUERY
  SELECT 
    'Mappings with our_user_id'::TEXT,
    COUNT(*)::BIGINT,
    'Mappings that have our_user_id set'::TEXT
  FROM employee_mappings 
  WHERE our_user_id IS NOT NULL;
  
  -- Count mappings without our_user_id
  RETURN QUERY
  SELECT 
    'Mappings without our_user_id'::TEXT,
    COUNT(*)::BIGINT,
    'Mappings that are missing our_user_id'::TEXT
  FROM employee_mappings 
  WHERE our_user_id IS NULL;
  
  -- Count mappings with our_profile_id
  RETURN QUERY
  SELECT 
    'Mappings with our_profile_id'::TEXT,
    COUNT(*)::BIGINT,
    'Mappings that have our_profile_id set'::TEXT
  FROM employee_mappings 
  WHERE our_profile_id IS NOT NULL;
  
  -- Count mappings without our_profile_id
  RETURN QUERY
  SELECT 
    'Mappings without our_profile_id'::TEXT,
    COUNT(*)::BIGINT,
    'Mappings that are missing our_profile_id'::TEXT
  FROM employee_mappings 
  WHERE our_profile_id IS NULL;
  
END;
$$;

-- Run the analysis
SELECT * FROM public.analyze_employee_mappings();

-- Show sample mappings
SELECT 
  'Sample employee mappings' as info,
  teamoffice_emp_code,
  teamoffice_name,
  our_user_id,
  our_name,
  our_profile_id,
  is_active,
  created_at
FROM employee_mappings 
ORDER BY created_at DESC 
LIMIT 10;

