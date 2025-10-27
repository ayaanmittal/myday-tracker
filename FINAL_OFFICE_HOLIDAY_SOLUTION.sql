-- Final Office Holiday Solution
-- This script creates a solution that completely bypasses the auto-marking system

-- Step 1: Create a function that uses a completely different approach
CREATE OR REPLACE FUNCTION public.mark_office_holiday_range_final(
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
  v_user_id UUID;
  v_date DATE;
  i INTEGER;
BEGIN
  RAISE NOTICE 'Final function called by user: %', v_uid;

  -- Get user IDs (all active employees if not specified)
  IF user_ids IS NULL OR array_length(user_ids, 1) IS NULL OR array_length(user_ids, 1) = 0 THEN
    SELECT COALESCE(array_agg(p.id), '{}')
    INTO v_user_ids
    FROM public.profiles p
    WHERE COALESCE(p.is_active, TRUE) = TRUE;
  ELSE
    v_user_ids := user_ids;
  END IF;

  -- Process each user and date combination
  FOR i IN 1..array_length(v_user_ids, 1) LOOP
    v_user_id := v_user_ids[i];
    
    v_date := start_date;
    WHILE v_date <= end_date LOOP
      -- First, delete any existing record to avoid conflicts
      DELETE FROM public.unified_attendance 
      WHERE user_id = v_user_id AND entry_date = v_date;
      
      -- Then insert the new record with explicit values
      INSERT INTO public.unified_attendance (
        user_id, 
        entry_date, 
        device_info, 
        source, 
        status, 
        manual_status, 
        modification_reason, 
        manual_override_by, 
        manual_override_at,
        created_at,
        updated_at
      ) VALUES (
        v_user_id,
        v_date,
        'Office Holiday Override',
        'manual',
        'holiday',  -- Explicitly set to holiday
        'Office Holiday',
        'Office holiday - final solution',
        v_uid,
        NOW(),
        NOW(),
        NOW()
      );
      
      -- Immediately update the record to ensure it stays as holiday
      UPDATE public.unified_attendance 
      SET 
        status = 'holiday',
        manual_status = 'Office Holiday',
        modification_reason = 'Office holiday - final solution',
        manual_override_by = v_uid,
        manual_override_at = NOW(),
        updated_at = NOW()
      WHERE user_id = v_user_id AND entry_date = v_date;
      
      v_inserted := v_inserted + 1;
      v_date := v_date + INTERVAL '1 day';
    END LOOP;
  END LOOP;

  RETURN json_build_object(
    'inserted', v_inserted,
    'updated', 0,
    'message', 'Office holiday records created with final solution'
  );
END;
$$;

-- Step 2: Grant permissions
GRANT EXECUTE ON FUNCTION public.mark_office_holiday_range_final(DATE, DATE, UUID[]) TO authenticated;

-- Step 3: Test the final function
SELECT 'Step 3: Test final function' as step;
SELECT public.mark_office_holiday_range_final(
  '2025-02-10'::DATE, 
  '2025-02-10'::DATE, 
  NULL
) as result;

-- Step 4: Check if the final function worked
SELECT 'Step 4: Check final function results' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-02-10'::DATE
ORDER BY p.name;

-- Step 5: If the final function works, update the original function
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
  v_user_id UUID;
  v_date DATE;
  i INTEGER;
BEGIN
  RAISE NOTICE 'mark_office_holiday_range called by user: %', v_uid;

  -- Get user IDs (all active employees if not specified)
  IF user_ids IS NULL OR array_length(user_ids, 1) IS NULL OR array_length(user_ids, 1) = 0 THEN
    SELECT COALESCE(array_agg(p.id), '{}')
    INTO v_user_ids
    FROM public.profiles p
    WHERE COALESCE(p.is_active, TRUE) = TRUE;
  ELSE
    v_user_ids := user_ids;
  END IF;

  -- Process each user and date combination
  FOR i IN 1..array_length(v_user_ids, 1) LOOP
    v_user_id := v_user_ids[i];
    
    v_date := start_date;
    WHILE v_date <= end_date LOOP
      -- First, delete any existing record to avoid conflicts
      DELETE FROM public.unified_attendance 
      WHERE user_id = v_user_id AND entry_date = v_date;
      
      -- Then insert the new record with explicit values
      INSERT INTO public.unified_attendance (
        user_id, 
        entry_date, 
        device_info, 
        source, 
        status, 
        manual_status, 
        modification_reason, 
        manual_override_by, 
        manual_override_at,
        created_at,
        updated_at
      ) VALUES (
        v_user_id,
        v_date,
        'Office Holiday Override',
        'manual',
        'holiday',  -- Explicitly set to holiday
        'Office Holiday',
        'Office holiday - final solution',
        v_uid,
        NOW(),
        NOW(),
        NOW()
      );
      
      -- Immediately update the record to ensure it stays as holiday
      UPDATE public.unified_attendance 
      SET 
        status = 'holiday',
        manual_status = 'Office Holiday',
        modification_reason = 'Office holiday - final solution',
        manual_override_by = v_uid,
        manual_override_at = NOW(),
        updated_at = NOW()
      WHERE user_id = v_user_id AND entry_date = v_date;
      
      v_inserted := v_inserted + 1;
      v_date := v_date + INTERVAL '1 day';
    END LOOP;
  END LOOP;

  RETURN json_build_object(
    'inserted', v_inserted,
    'updated', 0
  );
END;
$$;

-- Step 6: Test the updated original function
SELECT 'Step 6: Test updated original function' as step;
SELECT public.mark_office_holiday_range(
  '2025-02-11'::DATE, 
  '2025-02-11'::DATE, 
  NULL
) as result;

-- Step 7: Check final results
SELECT 'Step 7: Check final results' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-02-11'::DATE
ORDER BY p.name;
