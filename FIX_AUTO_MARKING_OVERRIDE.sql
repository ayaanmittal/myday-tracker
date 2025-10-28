-- Fix Auto-Marking Override Issue
-- This script fixes the issue where auto-marking is overriding office holiday status

-- Step 1: Check what triggers exist that might be auto-marking
SELECT 'Step 1: Check auto-marking triggers' as step;
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'unified_attendance'
  AND event_object_schema = 'public'
  AND (trigger_name ILIKE '%auto%' OR trigger_name ILIKE '%mark%');

-- Step 2: Look for the specific function that's doing the auto-marking
SELECT 'Step 2: Find auto-marking function' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%Auto-marked as absent%';

-- Step 3: Check if there's a function that handles work day marking
SELECT 'Step 3: Check work day marking functions' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_definition ILIKE '%work day%' OR routine_definition ILIKE '%no attendance%');

-- Step 4: Create a function that properly handles office holidays
-- This function will set the status correctly and prevent auto-override
CREATE OR REPLACE FUNCTION public.mark_office_holiday_range_fixed(
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
BEGIN
  RAISE NOTICE 'Fixed function called by user: %', v_uid;
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

  -- Process each user and date combination
  FOR i IN 1..array_length(v_user_ids, 1) LOOP
    v_user_id := v_user_ids[i];
    
    FOR v_date IN start_date..end_date LOOP
      -- Use UPSERT to handle both insert and update
      INSERT INTO public.unified_attendance (
        user_id, entry_date, device_info, source, status, manual_status, modification_reason, manual_override_by, manual_override_at
      ) VALUES (
        v_user_id,
        v_date,
        'Office Holiday Override',
        'manual',
        'holiday',  -- Explicitly set to holiday
        'Office Holiday',
        'Office holiday - no auto-marking',
        v_uid,
        NOW()
      )
      ON CONFLICT (user_id, entry_date) DO UPDATE SET
        status = 'holiday',  -- Force status to holiday
        manual_status = 'Office Holiday',
        modification_reason = 'Office holiday - no auto-marking',
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
    'message', 'Office holiday records created with fixed status'
  );
END;
$$;

-- Step 5: Grant permissions
GRANT EXECUTE ON FUNCTION public.mark_office_holiday_range_fixed(DATE, DATE, UUID[]) TO authenticated;

-- Step 6: Test the fixed function
SELECT 'Step 6: Test fixed function' as step;
SELECT public.mark_office_holiday_range_fixed(
  '2025-02-01'::DATE, 
  '2025-02-01'::DATE, 
  NULL
) as result;

-- Step 7: Check if the fixed function worked
SELECT 'Step 7: Check fixed function results' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-02-01'::DATE
ORDER BY p.name;

-- Step 8: Update the original function to use the same logic
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
    
    FOR v_date IN start_date..end_date LOOP
      -- Use UPSERT to handle both insert and update
      INSERT INTO public.unified_attendance (
        user_id, entry_date, device_info, source, status, manual_status, modification_reason, manual_override_by, manual_override_at
      ) VALUES (
        v_user_id,
        v_date,
        'Office Holiday Override',
        'manual',
        'holiday',  -- Explicitly set to holiday
        'Office Holiday',
        'Office holiday - no auto-marking',
        v_uid,
        NOW()
      )
      ON CONFLICT (user_id, entry_date) DO UPDATE SET
        status = 'holiday',  -- Force status to holiday
        manual_status = 'Office Holiday',
        modification_reason = 'Office holiday - no auto-marking',
        manual_override_by = v_uid,
        manual_override_at = NOW(),
        updated_at = NOW();
      
      v_inserted := v_inserted + 1;
    END LOOP;
  END LOOP;

  RETURN json_build_object(
    'inserted', v_inserted,
    'updated', 0
  );
END;
$$;

-- Step 9: Test the updated original function
SELECT 'Step 9: Test updated original function' as step;
SELECT public.mark_office_holiday_range(
  '2025-02-02'::DATE, 
  '2025-02-02'::DATE, 
  NULL
) as result;

-- Step 10: Check final results
SELECT 'Step 10: Check final results' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-02-02'::DATE
ORDER BY p.name;

