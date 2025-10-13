-- Create api_refresh_logs table
CREATE TABLE public.api_refresh_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  success boolean NOT NULL,
  duration_ms integer NOT NULL,
  connection_test_success boolean NOT NULL,
  connection_test_error text,
  employee_sync_success boolean NOT NULL,
  employee_sync_fetched integer NOT NULL DEFAULT 0,
  employee_sync_synced integer NOT NULL DEFAULT 0,
  employee_sync_errors text[] DEFAULT '{}',
  attendance_sync_success boolean NOT NULL,
  attendance_sync_found integer NOT NULL DEFAULT 0,
  attendance_sync_processed integer NOT NULL DEFAULT 0,
  attendance_sync_errors text[] DEFAULT '{}',
  total_errors text[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_refresh_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all API refresh logs"
  ON public.api_refresh_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert API refresh logs"
  ON public.api_refresh_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create index for better performance
CREATE INDEX idx_api_refresh_logs_created_at ON public.api_refresh_logs(created_at DESC);
CREATE INDEX idx_api_refresh_logs_admin_user_id ON public.api_refresh_logs(admin_user_id);

