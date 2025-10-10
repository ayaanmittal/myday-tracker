-- Add manual update tracking fields to attendance_logs table
-- Run this in Supabase SQL Editor

ALTER TABLE public.attendance_logs 
ADD COLUMN IF NOT EXISTS is_manual_update boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_by uuid,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS update_reason text,
ADD COLUMN IF NOT EXISTS original_log_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS original_source text;

-- Add foreign key constraint for updated_by
ALTER TABLE public.attendance_logs 
ADD CONSTRAINT IF NOT EXISTS attendance_logs_updated_by_fkey 
FOREIGN KEY (updated_by) REFERENCES auth.users(id);

-- Add index for better performance on manual updates
CREATE INDEX IF NOT EXISTS idx_attendance_logs_manual_updates 
ON public.attendance_logs (is_manual_update, updated_at);

-- Add trigger to automatically set updated_at when record is modified
CREATE OR REPLACE FUNCTION update_attendance_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_attendance_logs_updated_at ON public.attendance_logs;
CREATE TRIGGER trigger_update_attendance_logs_updated_at
    BEFORE UPDATE ON public.attendance_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_attendance_logs_updated_at();


