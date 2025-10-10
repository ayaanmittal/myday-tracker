-- Create settings table for system configuration
CREATE TABLE public.settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  data_type text NOT NULL DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for settings
CREATE POLICY "Admins can view all settings"
  ON public.settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all settings"
  ON public.settings FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION public.update_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_settings_updated_at();

-- Insert default settings
INSERT INTO public.settings (key, value, description, category, data_type, is_public) VALUES
  ('workday_start_time', '10:30', 'Default workday start time for employees', 'attendance', 'string', true),
  ('late_threshold_minutes', '15', 'Minutes after start time to mark as late', 'attendance', 'number', true),
  ('allow_multiple_updates', 'false', 'Allow employees to edit their daily updates', 'updates', 'boolean', false),
  ('enable_reminders', 'true', 'Enable system reminders for check-in and updates', 'notifications', 'boolean', true),
  ('max_work_hours', '8', 'Maximum work hours per day', 'attendance', 'number', true),
  ('overtime_threshold', '8', 'Hours after which overtime applies', 'attendance', 'number', true),
  ('auto_approve_leave', 'false', 'Automatically approve leave requests', 'leave', 'boolean', false),
  ('notification_email', 'admin@company.com', 'Email address for system notifications', 'notifications', 'string', false),
  ('company_name', 'Zoogol Systems', 'Company name for display', 'general', 'string', true),
  ('timezone', 'Asia/Kolkata', 'Default timezone for the system', 'general', 'string', true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_settings_category ON public.settings(category);
CREATE INDEX IF NOT EXISTS idx_settings_key ON public.settings(key);
