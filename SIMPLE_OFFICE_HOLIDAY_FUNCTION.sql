-- Simple Office Holiday Function
-- This creates a very basic version to test if the issue is with the function logic

-- Drop existing function
DROP FUNCTION IF EXISTS public.mark_office_holiday_range(DATE, DATE, UUID[]);

-- Create a very simple version
CREATE OR REPLACE FUNCTION public.mark_office_holiday_range(
  start_date DATE,
  end_date DATE,
  user_ids UUID[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_inserted INTEGER := 0;
  v_updated INTEGER := 0;
  v_user_ids UUID[];
BEGIN
  RAISE NOTICE 'Simple function called by user: %', v_uid;
  RAISE NOTICE 'Parameters: start_date=%, end_date=%, user_ids=%', start_date, end_date, user_ids;

  -- Get user IDs (all active employees if not specified)
  IF user_ids IS NULL OR array_length(user_ids, 1) IS NULL OR array_length(user_ids, 1) = 0 THEN
    SELECT COALESCE(array_agg(p.id), '{}')
    INTO v_user_ids
    FROM public.profiles p
    WHERE COALESCE(p.is_active, TRUE) = TRUE;
  ELSE
    v_user_ids := user_ids;
  END IF;

  RAISE NOTICE 'Processing % users', array_length(v_user_ids, 1);

  -- Simple insert for each user and date
  FOR i IN 1..array_length(v_user_ids, 1) LOOP
    FOR d IN start_date..end_date LOOP
      -- Insert or update record
      INSERT INTO public.unified_attendance (
        user_id, entry_date, device_info, source, status, manual_status, modification_reason, manual_override_by, manual_override_at
      ) VALUES (
        v_user_ids[i],
        d,
        'Simple Function',
        'manual',
        'holiday',
        'Office Holiday',
        'Simple office holiday override',
        v_uid,
        NOW()
      )
      ON CONFLICT (user_id, entry_date) DO UPDATE SET
        status = 'holiday',
        manual_status = 'Office Holiday',
        modification_reason = 'Simple office holiday override',
        manual_override_by = v_uid,
        manual_override_at = NOW(),
        updated_at = NOW();
      
      v_inserted := v_inserted + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Processed % records', v_inserted;

  RETURN json_build_object(
    'inserted', v_inserted,
    'updated', 0,
    'message', 'Simple function completed'
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.mark_office_holiday_range(DATE, DATE, UUID[]) TO authenticated;

-- Test the simple function
SELECT 'Testing simple function' as step;
SELECT public.mark_office_holiday_range(
  '2025-01-30'::DATE, 
  '2025-01-30'::DATE, 
  NULL
) as result;

-- Check if it worked
SELECT 'Checking results' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-01-30'::DATE
ORDER BY p.name;

