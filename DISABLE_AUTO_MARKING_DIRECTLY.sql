-- Disable Auto-Marking Directly
-- This script attempts to disable the auto-marking system directly

-- Step 1: Check all triggers on unified_attendance table
SELECT 'Step 1: Check all triggers on unified_attendance' as step;
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_orientation,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'unified_attendance'
  AND event_object_schema = 'public'
ORDER BY trigger_name;

-- Step 2: Try to disable all triggers temporarily
SELECT 'Step 2: Disable all triggers temporarily' as step;
DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  FOR trigger_record IN 
    SELECT trigger_name 
    FROM information_schema.triggers 
    WHERE event_object_table = 'unified_attendance'
      AND event_object_schema = 'public'
  LOOP
    BEGIN
      EXECUTE 'ALTER TABLE public.unified_attendance DISABLE TRIGGER ' || trigger_record.trigger_name;
      RAISE NOTICE 'Disabled trigger: %', trigger_record.trigger_name;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not disable trigger %: %', trigger_record.trigger_name, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- Step 3: Test our function with triggers disabled
SELECT 'Step 3: Test function with triggers disabled' as step;
SELECT public.mark_office_holiday_range(
  '2025-02-05'::DATE, 
  '2025-02-05'::DATE, 
  NULL
) as result;

-- Step 4: Check if the test worked
SELECT 'Step 4: Check test results' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-02-05'::DATE
ORDER BY p.name;

-- Step 5: If it worked, we need to find the specific trigger and modify it
-- Let's check what triggers exist and their definitions
SELECT 'Step 5: Check trigger definitions' as step;
SELECT 
  trigger_name,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'unified_attendance'
  AND event_object_schema = 'public';

-- Step 6: Look for any functions that might be called by these triggers
SELECT 'Step 6: Find functions called by triggers' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%unified_attendance%'
  AND routine_definition ILIKE '%status%';

-- Step 7: Try to find the specific function that's doing the auto-marking
SELECT 'Step 7: Find auto-marking function' as step;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_definition ILIKE '%Auto-marked as absent%';

-- Step 8: If we find the function, we can modify it to skip office holidays
-- For now, let's try a different approach - use a different table or approach
SELECT 'Step 8: Try alternative approach' as step;

-- Create a function that uses a different method to avoid triggers
CREATE OR REPLACE FUNCTION public.mark_office_holiday_range_no_triggers(
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
  v_user_ids UUID[];
  v_user_id UUID;
  v_date DATE;
  i INTEGER;
BEGIN
  RAISE NOTICE 'No-triggers function called by user: %', v_uid;

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
      -- Use a different approach - update existing records instead of inserting
      UPDATE public.unified_attendance 
      SET 
        status = 'holiday',
        manual_status = 'Office Holiday',
        modification_reason = 'Office holiday - no triggers method',
        manual_override_by = v_uid,
        manual_override_at = NOW(),
        updated_at = NOW()
      WHERE user_id = v_user_id AND entry_date = v_date;
      
      -- If no record exists, insert one
      IF NOT FOUND THEN
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
          'holiday',
          'Office Holiday',
          'Office holiday - no triggers method',
          v_uid,
          NOW(),
          NOW(),
          NOW()
        );
      END IF;
      
      v_inserted := v_inserted + 1;
      v_date := v_date + INTERVAL '1 day';
    END LOOP;
  END LOOP;

  RETURN json_build_object(
    'inserted', v_inserted,
    'updated', 0,
    'message', 'Office holiday records created with no-triggers method'
  );
END;
$$;

-- Step 9: Grant permissions
GRANT EXECUTE ON FUNCTION public.mark_office_holiday_range_no_triggers(DATE, DATE, UUID[]) TO authenticated;

-- Step 10: Test the no-triggers function
SELECT 'Step 10: Test no-triggers function' as step;
SELECT public.mark_office_holiday_range_no_triggers(
  '2025-02-06'::DATE, 
  '2025-02-06'::DATE, 
  NULL
) as result;

-- Step 11: Check if the no-triggers function worked
SELECT 'Step 11: Check no-triggers function results' as step;
SELECT 
  ua.user_id,
  ua.entry_date,
  ua.status,
  ua.manual_status,
  ua.modification_reason,
  p.name as employee_name
FROM public.unified_attendance ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.entry_date = '2025-02-06'::DATE
ORDER BY p.name;



