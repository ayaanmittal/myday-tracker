-- Fix get_attendance_summary function to use unified_attendance table instead of dropped attendance_logs table

-- Drop the old function that references attendance_logs
DROP FUNCTION IF EXISTS get_attendance_summary(DATE);

-- Create new function that uses unified_attendance table
CREATE OR REPLACE FUNCTION get_attendance_summary(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  employee_id TEXT,
  employee_name TEXT,
  first_checkin TIMESTAMPTZ,
  last_checkout TIMESTAMPTZ,
  total_manual_logs BIGINT,
  total_biometric_logs BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ua.user_id::text as employee_id,
    COALESCE(ua.employee_name, p.name) as employee_name,
    ua.check_in_at as first_checkin,
    ua.check_out_at as last_checkout,
    CASE WHEN ua.source = 'manual' THEN 1 ELSE 0 END as total_manual_logs,
    CASE WHEN ua.source IN ('teamoffice', 'biometric') THEN 1 ELSE 0 END as total_biometric_logs
  FROM unified_attendance ua
  LEFT JOIN profiles p ON ua.user_id = p.id
  WHERE ua.entry_date = p_date
  ORDER BY COALESCE(ua.employee_name, p.name);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_attendance_summary(DATE) TO authenticated;

-- Also update get_employee_attendance function to use unified_attendance
DROP FUNCTION IF EXISTS get_employee_attendance(TEXT, DATE, DATE);

CREATE OR REPLACE FUNCTION get_employee_attendance(
  p_employee_id TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  log_time TIMESTAMPTZ,
  log_type TEXT,
  device_id TEXT,
  source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ua.check_in_at as log_time,
    'checkin'::text as log_type,
    ua.device_id,
    ua.source
  FROM unified_attendance ua
  WHERE ua.user_id::text = p_employee_id
    AND ua.entry_date BETWEEN p_start_date AND p_end_date
    AND ua.check_in_at IS NOT NULL
  
  UNION ALL
  
  SELECT 
    ua.check_out_at as log_time,
    'checkout'::text as log_type,
    ua.device_id,
    ua.source
  FROM unified_attendance ua
  WHERE ua.user_id::text = p_employee_id
    AND ua.entry_date BETWEEN p_start_date AND p_end_date
    AND ua.check_out_at IS NOT NULL
  
  ORDER BY log_time ASC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_employee_attendance(TEXT, DATE, DATE) TO authenticated;
