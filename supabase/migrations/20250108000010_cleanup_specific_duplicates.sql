-- Clean up specific duplicate pattern: entries with both teamoffice and numeric device IDs

-- Create function to clean up the specific duplicate pattern
CREATE OR REPLACE FUNCTION public.cleanup_specific_duplicates()
RETURNS TABLE (
  removed_entries INTEGER,
  details TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_removed_entries INTEGER := 0;
  v_details TEXT := '';
BEGIN
  -- Remove entries that have numeric device_info (like "52", "46", etc.)
  -- These are likely the raw TeamOffice entries that should be replaced by mapped entries
  DELETE FROM day_entries 
  WHERE device_info ~ '^[0-9]+$'
    AND device_info != 'teamoffice'
    AND created_at > '2025-01-01'::date; -- Only remove recent entries
  
  GET DIAGNOSTICS v_removed_entries = ROW_COUNT;
  v_details := 'Removed ' || v_removed_entries || ' entries with numeric device_info';
  
  RETURN QUERY SELECT v_removed_entries, v_details;
END;
$$;

-- Also create a function to clean up entries where the same person appears multiple times on the same date
CREATE OR REPLACE FUNCTION public.cleanup_same_person_duplicates()
RETURNS TABLE (
  removed_entries INTEGER,
  details TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_removed_entries INTEGER := 0;
  v_details TEXT := '';
BEGIN
  -- Remove duplicate entries for the same person on the same date
  -- Keep the most recent entry (with teamoffice device_info if available)
  WITH ranked_entries AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, entry_date 
        ORDER BY 
          CASE WHEN device_info = 'TeamOffice API' THEN 1 ELSE 2 END, -- Prefer TeamOffice API entries
          created_at DESC
      ) as rn
    FROM day_entries
    WHERE (user_id, entry_date) IN (
      SELECT user_id, entry_date
      FROM day_entries 
      GROUP BY user_id, entry_date
      HAVING COUNT(*) > 1
    )
  )
  DELETE FROM day_entries 
  WHERE id IN (
    SELECT id FROM ranked_entries WHERE rn > 1
  );
  
  GET DIAGNOSTICS v_removed_entries = ROW_COUNT;
  v_details := 'Removed ' || v_removed_entries || ' duplicate entries for same person/date';
  
  RETURN QUERY SELECT v_removed_entries, v_details;
END;
$$;

-- Run both cleanup functions
SELECT * FROM public.cleanup_specific_duplicates();
SELECT * FROM public.cleanup_same_person_duplicates();

