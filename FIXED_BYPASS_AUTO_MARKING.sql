-- Fixed Bypass Auto-Marking System
-- This script creates a function that bypasses the auto-marking system with correct syntax

-- Step 1: Create a function that uses a different approach to avoid auto-marking
CREATE OR REPLACE FUNCTION public.mark_office_holiday_range_bypass(
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
  RAISE NOTICE 'Bypass function called by user: %', v_uid;

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
        'Office holiday - bypass auto-marking',
        v_uid,
        NOW(),
        NOW(),
        NOW()
      );
      
      v_inserted := v_inserted + 1;
      v_date := v_date + INTERVAL '1 day';
    END LOOP;
  END LOOP;

  RETURN json_build_object(
    'inserted', v_inserted,
    'updated', 0,
    'message', 'Office holiday records created with bypass method'
  );
END;
$$;

-- Step 2: Grant permissions
GRANT EXECUTE ON FUNCTION public.mark_office_holiday_range_bypass(DATE, DATE, UUID[]) TO authenticated;

-- Step 3: Test the bypass function
SELECT 'Step 3: Test bypass function' as step;
SELECT public.mark_office_holiday_range_bypass(
  '2025-02-03'::DATE, 
  '2025-02-03'::DATE, 
  NULL
) as result;

-- Step 4: Check if the bypass function worked
SELECT 'Step 4: Check bypass function results' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-02-03'::DATE
ORDER BY p.name;

-- Step 5: If the bypass works, update the original function
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
        'Office holiday - bypass auto-marking',
        v_uid,
        NOW(),
        NOW(),
        NOW()
      );
      
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
  '2025-02-04'::DATE, 
  '2025-02-04'::DATE, 
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
WHERE ua.entry_date = '2025-02-04'::DATE
ORDER BY p.name;
