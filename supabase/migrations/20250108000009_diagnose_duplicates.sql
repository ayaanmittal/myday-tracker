-- Diagnose duplicate entries to understand the root cause

-- Create function to analyze duplicate entries
CREATE OR REPLACE FUNCTION public.diagnose_duplicates()
RETURNS TABLE (
  analysis_type TEXT,
  count_value BIGINT,
  details TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Count total day entries
  RETURN QUERY
  SELECT 
    'Total day entries'::TEXT,
    COUNT(*)::BIGINT,
    'All entries in day_entries table'::TEXT
  FROM day_entries;
  
  -- Count entries by user_id type
  RETURN QUERY
  SELECT 
    'Entries with UUID user_id'::TEXT,
    COUNT(*)::BIGINT,
    'Entries where user_id is a proper UUID'::TEXT
  FROM day_entries 
  WHERE user_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  
  -- Count entries with numeric user_id (employee codes)
  RETURN QUERY
  SELECT 
    'Entries with numeric user_id'::TEXT,
    COUNT(*)::BIGINT,
    'Entries where user_id is numeric (employee code)'::TEXT
  FROM day_entries 
  WHERE user_id::text ~ '^[0-9]+$';
  
  -- Count entries by device_info
  RETURN QUERY
  SELECT 
    'Entries by device_info'::TEXT,
    COUNT(*)::BIGINT,
    device_info::TEXT
  FROM day_entries 
  GROUP BY device_info;
  
  -- Count duplicate entries (same user_id and entry_date)
  RETURN QUERY
  SELECT 
    'Duplicate entries'::TEXT,
    COUNT(*)::BIGINT,
    'Entries with same user_id and entry_date'::TEXT
  FROM (
    SELECT user_id, entry_date, COUNT(*) as cnt
    FROM day_entries 
    GROUP BY user_id, entry_date
    HAVING COUNT(*) > 1
  ) duplicates;
  
  -- Show sample duplicate entries
  RETURN QUERY
  SELECT 
    'Sample duplicates'::TEXT,
    COUNT(*)::BIGINT,
    'Sample of duplicate entries with details'::TEXT
  FROM (
    SELECT 
      de.user_id,
      de.entry_date,
      de.device_info,
      de.check_in_at,
      de.created_at,
      ROW_NUMBER() OVER (PARTITION BY de.user_id, de.entry_date ORDER BY de.created_at) as rn
    FROM day_entries de
    WHERE (de.user_id, de.entry_date) IN (
      SELECT user_id, entry_date
      FROM day_entries 
      GROUP BY user_id, entry_date
      HAVING COUNT(*) > 1
    )
  ) sample_duplicates
  WHERE rn <= 2; -- Show first 2 entries of each duplicate group
  
  -- Count entries that should be mapped but aren't
  RETURN QUERY
  SELECT 
    'Unmapped but should be mapped'::TEXT,
    COUNT(*)::BIGINT,
    'Entries with numeric user_id that have no mapping'::TEXT
  FROM day_entries de
  LEFT JOIN employee_mappings em ON de.user_id::text = em.teamoffice_emp_code
  WHERE de.user_id::text ~ '^[0-9]+$'
    AND em.teamoffice_emp_code IS NULL;
    
END;
$$;

-- Run the diagnosis
SELECT * FROM public.diagnose_duplicates();

-- Also show some sample data
SELECT 
  'Sample day_entries' as info,
  user_id,
  entry_date,
  device_info,
  check_in_at,
  created_at
FROM day_entries 
ORDER BY entry_date DESC, created_at DESC 
LIMIT 10;

