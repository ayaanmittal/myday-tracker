-- Add processed field to leave_requests table to track which leaves have been processed in attendance system
-- This migration adds a boolean field to track if a leave request has been processed

-- Add the processed field
ALTER TABLE public.leave_requests 
ADD COLUMN IF NOT EXISTS processed BOOLEAN NOT NULL DEFAULT false;

-- Add a comment to explain the field
COMMENT ON COLUMN public.leave_requests.processed IS 'Indicates if this leave request has been processed in the attendance system';

-- Create an index for better performance when querying processed leaves
CREATE INDEX IF NOT EXISTS idx_leave_requests_processed 
ON public.leave_requests(processed) 
WHERE processed = true;

-- Create a function to mark leave requests as processed
CREATE OR REPLACE FUNCTION public.mark_leave_requests_processed(
  p_user_ids UUID[],
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER := 0;
  result JSON;
BEGIN
  -- Check if the current user is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can mark leave requests as processed';
  END IF;

  -- Update leave requests to mark them as processed
  UPDATE public.leave_requests 
  SET 
    processed = true,
    updated_at = now()
  WHERE user_id = ANY(p_user_ids)
    AND start_date = p_start_date
    AND end_date = p_end_date
    AND status = 'approved'
    AND processed = false;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  result := json_build_object(
    'success', true,
    'updated_count', updated_count,
    'message', format('Marked %s leave requests as processed', updated_count)
  );

  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.mark_leave_requests_processed TO authenticated;
