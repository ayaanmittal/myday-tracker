-- Alter existing meetings table to add missing fields and create view
-- This migration assumes the meetings table already exists

-- Add any missing columns (in case they don't exist)
DO $$
BEGIN
    -- Add title column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'meetings' AND column_name = 'title') THEN
        ALTER TABLE meetings ADD COLUMN title TEXT NOT NULL DEFAULT 'Untitled Meeting';
    END IF;
    
    -- Add meeting_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'meetings' AND column_name = 'meeting_date') THEN
        ALTER TABLE meetings ADD COLUMN meeting_date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
    
    -- Add meeting_minutes column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'meetings' AND column_name = 'meeting_minutes') THEN
        ALTER TABLE meetings ADD COLUMN meeting_minutes TEXT NOT NULL DEFAULT '';
    END IF;
    
    -- Add created_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'meetings' AND column_name = 'created_by') THEN
        ALTER TABLE meetings ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'meetings' AND column_name = 'updated_at') THEN
        ALTER TABLE meetings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings (meeting_date);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings (created_by);

-- Enable RLS if not already enabled
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view all meetings" ON meetings;
DROP POLICY IF EXISTS "Managers and admins can create meetings" ON meetings;
DROP POLICY IF EXISTS "Managers and admins can update meetings" ON meetings;
DROP POLICY IF EXISTS "Managers and admins can delete meetings" ON meetings;

-- Create RLS policies
-- Users can view all meetings
CREATE POLICY "Users can view all meetings"
  ON meetings FOR SELECT
  USING (true);

-- Managers and admins can insert meetings
CREATE POLICY "Managers and admins can create meetings"
  ON meetings FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- Managers and admins can update meetings
CREATE POLICY "Managers and admins can update meetings"
  ON meetings FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- Managers and admins can delete meetings
CREATE POLICY "Managers and admins can delete meetings"
  ON meetings FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- Create function to update timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION update_meetings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for updated_at if it doesn't exist
DROP TRIGGER IF EXISTS trg_update_meetings_updated_at ON meetings;
CREATE TRIGGER trg_update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_meetings_updated_at();

-- Create or replace the view to show meetings with creator information
CREATE OR REPLACE VIEW meetings_with_creator AS
SELECT 
  m.*,
  p.name as created_by_name,
  p.email as created_by_email
FROM meetings m
LEFT JOIN profiles p ON m.created_by = p.id;

-- Grant access to the view
GRANT SELECT ON meetings_with_creator TO authenticated;

-- Show completion summary
DO $$
BEGIN
  RAISE NOTICE 'Meetings Table Alteration Complete!';
  RAISE NOTICE '  Added missing columns if needed';
  RAISE NOTICE '  Created indexes';
  RAISE NOTICE '  Enabled RLS policies';
  RAISE NOTICE '  Created view: meetings_with_creator';
  RAISE NOTICE '  Ready for use!';
END $$;
