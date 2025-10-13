-- Fix device_info for entries that should be marked as TeamOffice API

-- Create function to fix device_info for TeamOffice entries
CREATE OR REPLACE FUNCTION public.fix_device_info()
RETURNS TABLE (
  updated_entries INTEGER,
  details TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_entries INTEGER := 0;
  v_details TEXT := '';
BEGIN
  -- Update entries that have null device_info but were created from TeamOffice API
  -- These are likely entries that were processed before the device_info fix
  UPDATE day_entries 
  SET 
    device_info = 'TeamOffice API',
    modification_reason = COALESCE(modification_reason, '') || '; Fixed device_info from null to TeamOffice API'
  WHERE device_info IS NULL
    AND modification_reason LIKE '%TeamOffice%'
    AND created_at >= '2025-01-01'::date;
  
  GET DIAGNOSTICS v_updated_entries = ROW_COUNT;
  v_details := 'Updated ' || v_updated_entries || ' entries with null device_info to TeamOffice API';
  
  RETURN QUERY SELECT v_updated_entries, v_details;
END;
$$;

-- Also create a function to identify entries that should be TeamOffice but aren't marked correctly
CREATE OR REPLACE FUNCTION public.identify_teamoffice_entries()
RETURNS TABLE (
  entry_id UUID,
  user_id UUID,
  entry_date DATE,
  device_info TEXT,
  modification_reason TEXT,
  created_at TIMESTAMPTZ,
  should_be_teamoffice BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    de.id,
    de.user_id,
    de.entry_date,
    de.device_info,
    de.modification_reason,
    de.created_at,
    CASE 
      WHEN de.modification_reason LIKE '%TeamOffice%' THEN true
      WHEN de.device_info = 'TeamOffice API' THEN true
      WHEN de.device_info IS NULL AND de.created_at >= '2025-01-01'::date THEN true
      ELSE false
    END as should_be_teamoffice
  FROM day_entries de
  WHERE de.entry_date >= '2025-01-01'::date
  ORDER BY de.created_at DESC
  LIMIT 20;
END;
$$;

-- Run the fix
SELECT * FROM public.fix_device_info();

-- Show sample entries to verify
SELECT * FROM public.identify_teamoffice_entries();

