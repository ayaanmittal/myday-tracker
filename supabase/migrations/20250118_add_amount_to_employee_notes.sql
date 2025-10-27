-- Add amount field to employee_notes table for salary advances
ALTER TABLE public.employee_notes 
ADD COLUMN amount NUMERIC(12,2) DEFAULT NULL;

-- Add comment to explain the amount field
COMMENT ON COLUMN public.employee_notes.amount IS 'Amount for salary advance notes (in currency)';

-- Create index for amount field for better query performance
CREATE INDEX idx_employee_notes_amount ON public.employee_notes(amount) WHERE amount IS NOT NULL;

-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_employee_notes_with_details(UUID, INTEGER, INTEGER);

-- Recreate the function with the amount field
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
  amount NUMERIC(12,2),
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
    en.amount,
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
