-- Create meetings table for storing meeting information
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  meeting_minutes TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings (meeting_date);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings (created_by);

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view all meetings
CREATE POLICY "Users can view all meetings"
  ON meetings FOR SELECT
  USING (true);
an
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

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_meetings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER trg_update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_meetings_updated_at();

-- Create a view to show meetings with creator information
CREATE OR REPLACE VIEW meetings_with_creator AS
SELECT 
  m.*,
  p.name as created_by_name,
  p.email as created_by_email
FROM meetings m
LEFT JOIN profiles p ON m.created_by = p.user_id;

-- Grant access to the view
GRANT SELECT ON meetings_with_creator TO authenticated;

-- Show creation summary
DO $$
BEGIN
  RAISE NOTICE 'Meetings Table Created Successfully!';
  RAISE NOTICE '  Table: meetings';
  RAISE NOTICE '  View: meetings_with_creator (includes creator name)';
  RAISE NOTICE '  RLS policies: Enabled';
  RAISE NOTICE '  Access: Managers and Admins can manage, all users can view';
  RAISE NOTICE '  Ready for use!';
END $$;


