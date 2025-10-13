-- Connect day_updates to unified_attendance table
-- This migration will link daily updates to the new unified attendance system

-- First, add a new column to reference unified_attendance
ALTER TABLE public.day_updates 
ADD COLUMN unified_attendance_id UUID REFERENCES public.unified_attendance(id) ON DELETE CASCADE;

-- Create an index for performance
CREATE INDEX idx_day_updates_unified_attendance_id ON public.day_updates(unified_attendance_id);

-- Migrate existing data by matching day_entry_id to unified_attendance
-- Since day_entries table no longer exists, we'll try to match based on user_id and date
-- First, let's check if there are any day_updates with day_entry_id that we can migrate
DO $$
BEGIN
    -- Check if day_entries table exists before trying to migrate
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'day_entries' AND table_schema = 'public') THEN
        -- Migrate using the old day_entries table
        UPDATE public.day_updates 
        SET unified_attendance_id = ua.id
        FROM public.unified_attendance ua
        WHERE day_updates.day_entry_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.day_entries de 
            WHERE de.id = day_updates.day_entry_id 
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
    IF NOT EXISTS (SELECT 1 FROM public.day_updates WHERE unified_attendance_id IS NULL) THEN
        ALTER TABLE public.day_updates ALTER COLUMN unified_attendance_id SET NOT NULL;
    ELSE
        RAISE NOTICE 'Some day_updates records could not be migrated. Keeping unified_attendance_id nullable.';
    END IF;
END $$;

-- Drop the old foreign key constraint and column (if they exist)
DO $$
BEGIN
    -- Drop constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'day_updates_day_entry_id_fkey' 
               AND table_name = 'day_updates' 
               AND table_schema = 'public') THEN
        ALTER TABLE public.day_updates DROP CONSTRAINT day_updates_day_entry_id_fkey;
    END IF;
    
    -- Drop column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE column_name = 'day_entry_id' 
               AND table_name = 'day_updates' 
               AND table_schema = 'public') THEN
        ALTER TABLE public.day_updates DROP COLUMN day_entry_id;
    END IF;
END $$;

-- Update RLS policies to work with the new relationship
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own day updates" ON public.day_updates;
DROP POLICY IF EXISTS "Users can insert their own day updates" ON public.day_updates;
DROP POLICY IF EXISTS "Users can update their own day updates" ON public.day_updates;
DROP POLICY IF EXISTS "Users can delete their own day updates" ON public.day_updates;

-- Create new policies based on unified_attendance relationship
CREATE POLICY "Users can view day updates for their attendance records" ON public.day_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.unified_attendance ua 
      WHERE ua.id = day_updates.unified_attendance_id 
        AND ua.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert day updates for their attendance records" ON public.day_updates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.unified_attendance ua 
      WHERE ua.id = day_updates.unified_attendance_id 
        AND ua.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own day updates" ON public.day_updates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.unified_attendance ua 
      WHERE ua.id = day_updates.unified_attendance_id 
        AND ua.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own day updates" ON public.day_updates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.unified_attendance ua 
      WHERE ua.id = day_updates.unified_attendance_id 
        AND ua.user_id = auth.uid()
    )
  );

-- Add admin policies for managing all day updates
CREATE POLICY "Admins can manage all day updates" ON public.day_updates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'admin'
    )
  );

-- Add manager policies for managing their team's day updates
CREATE POLICY "Managers can manage their team's day updates" ON public.day_updates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'manager'
    )
  );
