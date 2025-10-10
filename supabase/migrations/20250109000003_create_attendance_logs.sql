-- Create attendance_logs table for both manual and biometric data
CREATE TABLE IF NOT EXISTS attendance_logs (
  id BIGSERIAL PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_name TEXT,
  log_time TIMESTAMPTZ NOT NULL,
  log_type TEXT CHECK (log_type IN ('checkin','checkout','unknown')) NOT NULL,
  device_id TEXT,
  source TEXT DEFAULT 'teamoffice',           -- 'manual' or 'teamoffice'
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create unique index to prevent duplicates (same emp, same time, same device)
CREATE UNIQUE INDEX IF NOT EXISTS ux_att_unique
ON attendance_logs (employee_id, log_time, COALESCE(device_id,'NA'));

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_attendance_logs_employee_time 
ON attendance_logs (employee_id, log_time DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_source 
ON attendance_logs (source);

-- Create table to store incremental cursor for the LastRecord API
CREATE TABLE IF NOT EXISTS attendance_sync_state (
  id INT PRIMARY KEY DEFAULT 1,
  last_record TEXT,            -- e.g. '092020$454' (MMyyyy$ID)
  last_sync_at TIMESTAMPTZ
);

-- Insert initial sync state
INSERT INTO attendance_sync_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sync_state ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for attendance_logs
CREATE POLICY "Users can view own attendance logs"
  ON attendance_logs FOR SELECT
  USING (employee_id = auth.uid()::text OR employee_id IN (
    SELECT id::text FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can view all attendance logs"
  ON attendance_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert attendance logs"
  ON attendance_logs FOR INSERT
  WITH CHECK (true);

-- Create RLS policies for attendance_sync_state
CREATE POLICY "Admins can manage sync state"
  ON attendance_sync_state FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create function to get employee attendance for a date range
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
    al.log_time,
    al.log_type,
    al.device_id,
    al.source
  FROM attendance_logs al
  WHERE al.employee_id = p_employee_id
    AND al.log_time::date BETWEEN p_start_date AND p_end_date
  ORDER BY al.log_time ASC;
END;
$$;

-- Create function to get attendance summary for admin dashboard
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
    al.employee_id,
    al.employee_name,
    MIN(CASE WHEN al.log_type = 'checkin' THEN al.log_time END) as first_checkin,
    MAX(CASE WHEN al.log_type = 'checkout' THEN al.log_time END) as last_checkout,
    COUNT(CASE WHEN al.source = 'manual' THEN 1 END) as total_manual_logs,
    COUNT(CASE WHEN al.source = 'teamoffice' THEN 1 END) as total_biometric_logs
  FROM attendance_logs al
  WHERE al.log_time::date = p_date
  GROUP BY al.employee_id, al.employee_name
  ORDER BY al.employee_name;
END;
$$;
