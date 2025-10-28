-- COMPREHENSIVE LATE DETECTION UPDATE
-- This script updates all historical records and provides detailed reporting

-- Step 1: Create a function to update records for a specific date range
CREATE OR REPLACE FUNCTION public.update_late_status_for_date_range(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE(
  updated_count INTEGER,
  late_count INTEGER,
  on_time_count INTEGER,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count INTEGER := 0;
  v_late_count INTEGER := 0;
  v_on_time_count INTEGER := 0;
BEGIN
  -- Update records in the date range
  UPDATE public.unified_attendance 
  SET is_late = public.is_late_final(check_in_at),
      updated_at = NOW()
  WHERE check_in_at IS NOT NULL
    AND entry_date BETWEEN start_date AND end_date;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Count late vs on-time records
  SELECT 
    COUNT(CASE WHEN is_late = true THEN 1 END),
    COUNT(CASE WHEN is_late = false THEN 1 END)
  INTO v_late_count, v_on_time_count
  FROM public.unified_attendance 
  WHERE check_in_at IS NOT NULL
    AND entry_date BETWEEN start_date AND end_date;
  
  updated_count := v_updated_count;
  late_count := v_late_count;
  on_time_count := v_on_time_count;
  message := 'Updated ' || v_updated_count || ' records for ' || start_date || ' to ' || end_date;
  RETURN NEXT;
END;
$$;

-- Step 2: Update all records (no date restriction)
SELECT 
  'Updating ALL Records' as info,
  *
FROM public.update_late_status_for_date_range(
  '2020-01-01'::DATE, 
  CURRENT_DATE + INTERVAL '1 day'
);

-- Step 3: Update last 30 days specifically
SELECT 
  'Updating Last 30 Days' as info,
  *
FROM public.update_late_status_for_date_range(
  CURRENT_DATE - INTERVAL '30 days', 
  CURRENT_DATE
);

-- Step 4: Update last 7 days specifically
SELECT 
  'Updating Last 7 Days' as info,
  *
FROM public.update_late_status_for_date_range(
  CURRENT_DATE - INTERVAL '7 days', 
  CURRENT_DATE
);

-- Step 5: Show detailed results by employee
SELECT 
  'Results by Employee' as info,
  employee_name,
  COUNT(*) as total_days,
  COUNT(CASE WHEN is_late = true THEN 1 END) as late_days,
  COUNT(CASE WHEN is_late = false THEN 1 END) as on_time_days,
  ROUND(
    (COUNT(CASE WHEN is_late = true THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
    2
  ) as late_percentage
FROM public.unified_attendance 
WHERE check_in_at IS NOT NULL
  AND entry_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY employee_name
ORDER BY late_percentage DESC, late_days DESC;

-- Step 6: Show records that are now marked as LATE (recent)
SELECT 
  'Recent LATE Records' as info,
  employee_name,
  entry_date,
  check_in_at,
  CASE 
    WHEN check_in_at IS NOT NULL THEN 
      EXTRACT(HOUR FROM (check_in_at AT TIME ZONE 'Asia/Kolkata')) || ':' || 
      LPAD(EXTRACT(MINUTE FROM (check_in_at AT TIME ZONE 'Asia/Kolkata'))::TEXT, 2, '0')
    ELSE 'No check-in'
  END as checkin_time_ist
FROM public.unified_attendance 
WHERE check_in_at IS NOT NULL
  AND is_late = true
  AND entry_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY entry_date DESC, check_in_at DESC;

-- Step 7: Show daily summary for the last week
SELECT 
  'Daily Summary (Last 7 Days)' as info,
  entry_date,
  COUNT(*) as total_employees,
  COUNT(CASE WHEN is_late = true THEN 1 END) as late_employees,
  COUNT(CASE WHEN is_late = false THEN 1 END) as on_time_employees,
  ROUND(
    (COUNT(CASE WHEN is_late = true THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
    2
  ) as late_percentage
FROM public.unified_attendance 
WHERE check_in_at IS NOT NULL
  AND entry_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY entry_date
ORDER BY entry_date DESC;

-- Step 8: Grant permissions
GRANT EXECUTE ON FUNCTION public.update_late_status_for_date_range(DATE, DATE) TO authenticated;

