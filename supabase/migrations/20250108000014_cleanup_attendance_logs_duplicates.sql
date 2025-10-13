-- Clean up duplicate entries in attendance_logs table

-- Create function to clean up attendance_logs duplicates
CREATE OR REPLACE FUNCTION public.cleanup_attendance_logs_duplicates()
RETURNS TABLE (
  removed_entries INTEGER,
  details TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_removed_entries INTEGER := 0;
  v_details TEXT := '';
BEGIN
  -- Remove attendance_logs entries that have numeric employee_id (unmapped employee codes)
  -- These are the raw entries that should be replaced by mapped entries
  DELETE FROM attendance_logs 
  WHERE employee_id ~ '^[0-9]+$'  -- Numeric employee IDs
    AND source = 'teamoffice'
    AND log_time >= '2025-01-01'::date; -- Only remove recent entries
  
  GET DIAGNOSTICS v_removed_entries = ROW_COUNT;
  v_details := 'Removed ' || v_removed_entries || ' unmapped attendance_logs entries';
  
  RETURN QUERY SELECT v_removed_entries, v_details;
END;
$$;

-- Create function to clean up duplicate attendance_logs for same person/same time
CREATE OR REPLACE FUNCTION public.cleanup_attendance_logs_same_person()
RETURNS TABLE (
  removed_entries INTEGER,
  details TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_removed_entries INTEGER := 0;
  v_details TEXT := '';
BEGIN
  -- Remove duplicate attendance_logs for the same person at the same time
  -- Keep the one with device_id = 'teamoffice' (mapped entry)
  WITH ranked_logs AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY employee_id, log_time, log_type
        ORDER BY 
          CASE WHEN device_id = 'teamoffice' THEN 1 ELSE 2 END, -- Prefer teamoffice device
          created_at DESC
      ) as rn
    FROM attendance_logs
    WHERE (employee_id, log_time, log_type) IN (
      SELECT employee_id, log_time, log_type
      FROM attendance_logs 
      GROUP BY employee_id, log_time, log_type
      HAVING COUNT(*) > 1
    )
  )
  DELETE FROM attendance_logs 
  WHERE id IN (
    SELECT id FROM ranked_logs WHERE rn > 1
  );
  
  GET DIAGNOSTICS v_removed_entries = ROW_COUNT;
  v_details := 'Removed ' || v_removed_entries || ' duplicate attendance_logs for same person/time';
  
  RETURN QUERY SELECT v_removed_entries, v_details;
END;
$$;

-- Run both cleanup functions
SELECT * FROM public.cleanup_attendance_logs_duplicates();
SELECT * FROM public.cleanup_attendance_logs_same_person();

