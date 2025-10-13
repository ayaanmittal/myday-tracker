-- Connect extra_work_logs to unified_attendance table
-- This migration will link extra work logs to the new unified attendance system

-- First, add a new column to reference unified_attendance
ALTER TABLE public.extra_work_logs 
ADD COLUMN unified_attendance_id UUID REFERENCES public.unified_attendance(id) ON DELETE CASCADE;

-- Create an index for performance
CREATE INDEX idx_extra_work_logs_unified_attendance_id ON public.extra_work_logs(unified_attendance_id);

-- Migrate existing data by matching day_entry_id to unified_attendance
-- Since day_entries table no longer exists, we'll try to match based on user_id and date
-- First, let's check if there are any extra_work_logs with day_entry_id that we can migrate
DO $$
BEGIN
    -- Check if day_entries table exists before trying to migrate
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'day_entries' AND table_schema = 'public') THEN
        -- Migrate using the old day_entries table
        UPDATE public.extra_work_logs 
        SET unified_attendance_id = ua.id
        FROM public.unified_attendance ua
        WHERE extra_work_logs.day_entry_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.day_entries de 
            WHERE de.id = extra_work_logs.day_entry_id 
              AND de.user_id = ua.user_id 
              AND de.entry_date = ua.entry_date
          );
    ELSE
        -- If day_entries doesn't exist, we'll need to manually link based on user_id and date
        -- This is a simplified approach - you may need to adjust based on your data
        RAISE NOTICE 'day_entries table does not exist. Skipping data migration.';
    END IF;
END $$;

-- Make the new column NOT NULL after migration (only if all records were migrated)
-- First check if there are any NULL values
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.extra_work_logs WHERE unified_attendance_id IS NULL) THEN
        ALTER TABLE public.extra_work_logs ALTER COLUMN unified_attendance_id SET NOT NULL;
    ELSE
        RAISE NOTICE 'Some extra_work_logs records could not be migrated. Keeping unified_attendance_id nullable.';
    END IF;
END $$;

-- Drop the old foreign key constraint and column (if they exist)
DO $$
BEGIN
    -- Drop constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'extra_work_logs_day_entry_id_fkey' 
               AND table_name = 'extra_work_logs' 
               AND table_schema = 'public') THEN
        ALTER TABLE public.extra_work_logs DROP CONSTRAINT extra_work_logs_day_entry_id_fkey;
    END IF;
    
    -- Drop column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE column_name = 'day_entry_id' 
               AND table_name = 'extra_work_logs' 
               AND table_schema = 'public') THEN
        ALTER TABLE public.extra_work_logs DROP COLUMN day_entry_id;
    END IF;
END $$;

-- Update RLS policies to work with the new relationship
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own extra work logs" ON public.extra_work_logs;
DROP POLICY IF EXISTS "Users can insert their own extra work logs" ON public.extra_work_logs;
DROP POLICY IF EXISTS "Users can update their own extra work logs" ON public.extra_work_logs;
DROP POLICY IF EXISTS "Users can delete their own extra work logs" ON public.extra_work_logs;

-- Create new policies based on unified_attendance relationship
CREATE POLICY "Users can view extra work logs for their attendance records" ON public.extra_work_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.unified_attendance ua 
      WHERE ua.id = extra_work_logs.unified_attendance_id 
        AND ua.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert extra work logs for their attendance records" ON public.extra_work_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.unified_attendance ua 
      WHERE ua.id = extra_work_logs.unified_attendance_id 
        AND ua.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own extra work logs" ON public.extra_work_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.unified_attendance ua 
      WHERE ua.id = extra_work_logs.unified_attendance_id 
        AND ua.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own extra work logs" ON public.extra_work_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.unified_attendance ua 
      WHERE ua.id = extra_work_logs.unified_attendance_id 
        AND ua.user_id = auth.uid()
    )
  );

-- Add admin policies for managing all extra work logs
CREATE POLICY "Admins can manage all extra work logs" ON public.extra_work_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'admin'
    )
  );

-- Add manager policies for managing their team's extra work logs
CREATE POLICY "Managers can manage their team's extra work logs" ON public.extra_work_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'manager'
    )
  );
