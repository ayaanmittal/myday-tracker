-- Check attendance_logs table for duplicates

-- Create function to analyze attendance_logs
CREATE OR REPLACE FUNCTION public.analyze_attendance_logs()
RETURNS TABLE (
  analysis_type TEXT,
  count_value BIGINT,
  details TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Count total attendance logs
  RETURN QUERY
  SELECT 
    'Total attendance logs'::TEXT,
    COUNT(*)::BIGINT,
    'All entries in attendance_logs table'::TEXT
  FROM attendance_logs;
  
  -- Count logs by source
  RETURN QUERY
  SELECT 
    'Logs by source'::TEXT,
    COUNT(*)::BIGINT,
    source::TEXT
  FROM attendance_logs 
  GROUP BY source;
  
  -- Count logs by device_id
  RETURN QUERY
  SELECT 
    'Logs by device_id'::TEXT,
    COUNT(*)::BIGINT,
    COALESCE(device_id, 'NULL')::TEXT
  FROM attendance_logs 
  GROUP BY device_id;
  
  -- Count logs by log_type
  RETURN QUERY
  SELECT 
    'Logs by log_type'::TEXT,
    COUNT(*)::BIGINT,
    log_type::TEXT
  FROM attendance_logs 
  GROUP BY log_type;
  
  -- Count recent logs (last 7 days)
  RETURN QUERY
  SELECT 
    'Recent logs (7 days)'::TEXT,
    COUNT(*)::BIGINT,
    'Logs from last 7 days'::TEXT
  FROM attendance_logs 
  WHERE log_time >= NOW() - INTERVAL '7 days';
  
  -- Count duplicate logs (same employee, same time, different device)
  RETURN QUERY
  SELECT 
    'Potential duplicates'::TEXT,
    COUNT(*)::BIGINT,
    'Logs with same employee and time but different device'::TEXT
  FROM (
    SELECT employee_id, log_time, COUNT(DISTINCT device_id) as device_count
    FROM attendance_logs 
    WHERE log_time >= NOW() - INTERVAL '7 days'
    GROUP BY employee_id, log_time
    HAVING COUNT(DISTINCT device_id) > 1
  ) potential_duplicates;
  
END;
$$;

-- Run the analysis
SELECT * FROM public.analyze_attendance_logs();

-- Show sample attendance logs
SELECT 
  'Sample attendance_logs' as info,
  employee_id,
  employee_name,
  log_time,
  log_type,
  device_id,
  source
FROM attendance_logs 
WHERE log_time >= NOW() - INTERVAL '7 days'
ORDER BY log_time DESC 
LIMIT 15;

