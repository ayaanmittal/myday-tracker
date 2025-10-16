-- Create employee_notes table for admin notes about employees
CREATE TABLE public.employee_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_date DATE NOT NULL,
  note_time TIME,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN ('general', 'salary_advance', 'disciplinary', 'performance', 'leave', 'other')),
  is_private BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_employee_notes_employee_id ON public.employee_notes(employee_id);
CREATE INDEX idx_employee_notes_created_by ON public.employee_notes(created_by);
CREATE INDEX idx_employee_notes_note_date ON public.employee_notes(note_date);
CREATE INDEX idx_employee_notes_note_type ON public.employee_notes(note_type);
CREATE INDEX idx_employee_notes_created_at ON public.employee_notes(created_at);

-- Create RLS policies
ALTER TABLE public.employee_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view all notes
CREATE POLICY "Admins can view all employee notes" ON public.employee_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Policy: Only admins can insert notes
CREATE POLICY "Admins can create employee notes" ON public.employee_notes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Policy: Only admins can update notes
CREATE POLICY "Admins can update employee notes" ON public.employee_notes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Policy: Only admins can delete notes
CREATE POLICY "Admins can delete employee notes" ON public.employee_notes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION public.update_employee_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_employee_notes_updated_at
  BEFORE UPDATE ON public.employee_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_employee_notes_updated_at();

-- Create function to get employee notes with user details
CREATE OR REPLACE FUNCTION public.get_employee_notes_with_details(
  p_employee_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  employee_id UUID,
  employee_name TEXT,
  created_by_name TEXT,
  note_date DATE,
  note_time TIME,
  title TEXT,
  content TEXT,
  note_type TEXT,
  is_private BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    en.id,
    en.employee_id,
    p_emp.name as employee_name,
    p_creator.name as created_by_name,
    en.note_date,
    en.note_time,
    en.title,
    en.content,
    en.note_type,
    en.is_private,
    en.created_at,
    en.updated_at
  FROM employee_notes en
  JOIN profiles p_emp ON en.employee_id = p_emp.id
  JOIN profiles p_creator ON en.created_by = p_creator.id
  WHERE en.employee_id = p_employee_id
  ORDER BY en.note_date DESC, en.note_time DESC, en.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Create function to get employee notes count
CREATE OR REPLACE FUNCTION public.get_employee_notes_count(
  p_employee_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  note_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO note_count
  FROM employee_notes
  WHERE employee_id = p_employee_id;
  
  RETURN note_count;
END;
$$;

-- Show creation summary
DO $$
BEGIN
  RAISE NOTICE 'Employee Notes Table Created Successfully!';
  RAISE NOTICE '  Table: employee_notes';
  RAISE NOTICE '  RLS policies: Enabled (Admin only)';
  RAISE NOTICE '  Helper functions: get_employee_notes_with_details, get_employee_notes_count';
  RAISE NOTICE '  Note types: general, salary_advance, disciplinary, performance, leave, other';
END;
$$;
